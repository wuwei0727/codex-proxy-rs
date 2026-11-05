#!/usr/bin/env python3
"""双节点更新：摘流、等待旧连接、重建并验证，失败时保留可用节点。"""
import argparse
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time
import urllib.request
import urllib.error


def run(*args):
    result = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Compose 输出可能含配置，不把完整配置或环境打印到日志
        raise RuntimeError(f"命令失败（{result.returncode}）：{' '.join(args[:3])}")
    return result.stdout.strip()


def disabled_config(text, port):
    """只接受已知的双节点 upstream，避免修改其他站点。"""
    blocks = list(re.finditer(r'upstream\s+cpr_cluster\s*\{([^{}]*)\}', text))
    if len(blocks) != 1:
        raise RuntimeError('必须存在唯一 cpr_cluster upstream')
    block = blocks[0]
    body = block.group(1)
    servers = re.findall(r'^\s*server\s+([^;]+);', body, re.M)
    if len(servers) != 2 or {s.split()[0] for s in servers} != {'127.0.0.1:18080', '127.0.0.1:18081'}:
        raise RuntimeError('upstream 必须仅包含 18080、18081 两个节点')
    if any(re.search(r'\b(down|backup)\b', s) for s in servers):
        raise RuntimeError('已有节点被摘流或配置为备用，请先检查并恢复')
    body, count = re.subn(rf'(server\s+127\.0\.0\.1:{port}\b[^;]*);', r'\1 down;', body)
    if count != 1:
        raise RuntimeError('找不到唯一目标节点')
    return text[:block.start(1)] + body + text[block.end(1):]


class Updater:
    nodes = [('codex-proxy-rs-2', 18081), ('codex-proxy-rs', 18080)]

    def __init__(self, install, nginx, drain=600, ready=300):
        self.install = Path(install)
        self.nginx = Path(nginx).resolve()
        self.drain_timeout, self.ready_timeout = drain, ready
        self.expected_config = None
        self.compose = ['docker', 'compose', '-f', str(self.install / 'deploy/compose.yaml')]

    def healthy(self, port):
        try:
            # 本地探测不能受宿主 HTTP 代理环境影响
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(f'http://127.0.0.1:{port}/healthz', timeout=3) as response:
                return response.status == 204
        except (OSError, urllib.error.URLError):
            return False

    def workers(self):
        result = {}
        for line in run('ps', '-C', 'nginx', '-o', 'pid=,args=').splitlines():
            pid, command = line.strip().split(None, 1)
            if 'nginx: worker process' in command:
                # PID 和启动时间共同标识进程，避免 PID 重用
                stat = Path(f'/proc/{pid}/stat')
                try:
                    result[int(pid)] = stat.read_text().rsplit(')', 1)[1].split()[19]
                except FileNotFoundError:
                    pass
        return result

    def write_config(self, text):
        current = self.nginx.stat()
        fd, path = tempfile.mkstemp(dir=self.nginx.parent, prefix='.cpr-')
        try:
            with os.fdopen(fd, 'w') as stream:
                stream.write(text)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(path, current.st_mode & 0o777)
            os.chown(path, current.st_uid, current.st_gid)
            os.replace(path, self.nginx)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def configure(self, text):
        previous = self.nginx.read_text()
        if self.expected_config is not None and previous != self.expected_config:
            raise RuntimeError('Nginx 配置已被其他操作修改，停止更新，不覆盖外部修改')
        try:
            self.write_config(text)
            self.expected_config = text
            run('nginx', '-t')
            before = self.workers()
            run('nginx', '-s', 'reload')
            for _ in range(30):
                if set(self.workers().items()) - set(before.items()):
                    return
                time.sleep(0.2)
            raise RuntimeError('未确认 Nginx 新 worker 启动')
        except BaseException:
            if self.nginx.read_text() != text:
                raise RuntimeError('Nginx 配置发生外部修改，未自动恢复，请检查路由')
            self.write_config(previous)
            self.expected_config = previous
            run('nginx', '-t')
            run('nginx', '-s', 'reload')
            raise

    def wait_drain(self, old_workers):
        deadline = time.monotonic() + self.drain_timeout
        report = 0
        while set(old_workers.items()) & set(self.workers().items()):
            if time.monotonic() >= deadline:
                raise RuntimeError('旧连接未结束，取消更新，不强制关闭连接')
            if time.monotonic() >= report:
                print('等待旧 Nginx worker 完成连接；其他站点长连接也可能延长等待', flush=True)
                report = time.monotonic() + 30
            time.sleep(1)

    def container(self, service):
        cid = run(*self.compose, 'ps', '-q', service)
        if not cid or '\n' in cid:
            raise RuntimeError(f'{service} 必须有且仅有一个运行容器')
        return json.loads(run('docker', 'inspect', cid))[0]

    def preflight(self):
        original = self.nginx.read_text()
        self.expected_config = original
        for service, port in self.nodes:
            disabled_config(original, port)
            self.container(service)
            if not self.healthy(port):
                raise RuntimeError(f'{service} 不健康，请先恢复双节点，再执行滚动更新')
        config = run('nginx', '-T')
        if re.search(r'^\s*worker_shutdown_timeout\s+', config, re.M):
            raise RuntimeError('worker_shutdown_timeout 会强制关闭旧连接，请先检查 Nginx 配置')
        if str(self.nginx) not in config:
            # sites-enabled 通常是指向 sites-available 的软链接
            includes = re.findall(r'^# configuration file (.+):$', config, re.M)
            if not any(Path(p).resolve() == self.nginx for p in includes):
                raise RuntimeError('指定站点未被 Nginx 加载')
        if not self.workers():
            raise RuntimeError('没有找到 Nginx worker')
        return original

    def recreate(self, service, image):
        # 固定预检过的镜像 ID，后续 latest 改变不会混装不同版本
        override = {'services': {service: {'image': image}}}
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', dir=self.install / 'deploy') as stream:
            json.dump(override, stream)
            stream.flush()
            run(*self.compose, '-f', stream.name, 'up', '-d', '--no-deps', '--pull', 'never', service)

    def update_node(self, service, port, image, version, original):
        other = 18080 if port == 18081 else 18081
        if not self.healthy(other):
            raise RuntimeError('另一节点不健康，停止更新')
        old = self.workers()
        self.configure(disabled_config(original, port))
        changed = False
        try:
            self.wait_drain(old)
            if not self.healthy(other):
                raise RuntimeError('另一节点已不健康，停止更新')
            changed = True
            self.recreate(service, image)
            deadline = time.monotonic() + self.ready_timeout
            successes = 0
            while time.monotonic() < deadline:
                successes = successes + 1 if self.healthy(port) else 0
                if successes >= 3:
                    current = self.container(service)
                    actual = run('docker', 'exec', current['Id'], '/app/bin/codex-proxy-rs', '--version')
                    if current['Image'] != image or actual != version:
                        raise RuntimeError('运行镜像或版本与预检不一致')
                    self.configure(original)
                    print(f'{service} 已验证并恢复接流量', flush=True)
                    return
                time.sleep(2)
            raise RuntimeError(f'{service} 启动检查超时')
        except BaseException:
            if not changed:
                self.configure(original)
            else:
                print(f'{service} 保持摘流，另一节点继续服务；检查日志并人工恢复，禁止继续更新另一节点', flush=True)
            raise

    def update(self, check=False):
        original = self.preflight()
        if check:
            print('预检通过：双节点健康、Nginx 配置及 worker 可检查；未修改服务')
            return
        run(*self.compose, 'pull', *(s for s, _ in self.nodes))
        config = json.loads(run(*self.compose, 'config', '--format', 'json'))
        images = {run('docker', 'image', 'inspect', config['services'][s]['image'], '--format', '{{.Id}}') for s, _ in self.nodes}
        if len(images) != 1:
            raise RuntimeError('两个节点必须使用相同镜像')
        image = images.pop()
        version = run('docker', 'run', '--rm', '--network', 'none', image, '/app/bin/codex-proxy-rs', '--version')
        if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?', version):
            raise RuntimeError('镜像版本不合法，未更新任何节点')
        print(f'已固定镜像 {image}，版本 {version}', flush=True)
        for service, port in self.nodes:
            if self.container(service)['Image'] == image:
                print(f'{service} 已运行目标镜像，跳过重建', flush=True)
                continue
            self.update_node(service, port, image, version, original)


def main():
    import fcntl
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    install = os.environ.get('CPR_INSTALL_DIR', '/opt/codex-proxy-rs')
    nginx = os.environ.get('CPR_NGINX_CONFIG', '/etc/nginx/sites-available/cpr.ranran0112.ccwu.cc')
    drain = int(os.environ.get('CPR_DRAIN_TIMEOUT', '600'))
    ready = int(os.environ.get('CPR_READY_TIMEOUT', '300'))
    if min(drain, ready) <= 0:
        raise RuntimeError('等待时间必须为正整数')
    def interrupted(signum, frame):
        raise KeyboardInterrupt('更新被中断')
    signal.signal(signal.SIGTERM, interrupted)
    with open('/run/lock/cpr-update.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        Updater(install, nginx, drain, ready).update(args.check)


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(f'更新停止：{error}', flush=True)
        raise SystemExit(1)
