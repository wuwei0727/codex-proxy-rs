# Request-aware drain implementation plan

> 使用 executing-plans 在当前会话实施，完成后进行独立审查

**Goal:** 空闲节点立即更新，活动请求最多等待 60 秒

**Architecture:** API 层拥有本进程数据面请求计数与排空接纳状态。HTTP guard 覆盖响应体生命周期，Responses WebSocket 按单次任务计数，live sideband 按会话保守计数。内部控制端点仅接受容器内 loopback 直连，不信任转发头。脚本通过 docker exec 调用，不暴露公网控制能力

**Tech Stack:** Rust/Axum、Python、Docker Compose

**Spec:** 用户已确认的请求级排空方案；默认 60 秒，超时继续重建且提示可能中断

## 步骤

- [x] API 请求 guard、排空状态与本地控制端点；覆盖空闲、流式 body、WS 任务、拒绝新任务、权限及恢复
- [x] 更新脚本接入状态接口；旧版本仅在端点不存在时回退 TCP 等待；探测异常不得当空闲；重建前失败恢复接纳状态
- [x] 更新二次开发与运维手册，运行 API 和脚本测试及相关编译检查
- [ ] 独立审查、提交推送；服务器仅部署脚本，后端随新镜像生效，旧版首次升级可能仍等待

## 约束

不使用账号槽位或 Redis 全局计数，不把空闲 Responses WebSocket 当活动任务。不改变数据库。摘流期间旧连接新任务会被拒绝并需客户端重连。SIGKILL 不能保证自动恢复，保持摘流供人工恢复。实际线上容器升级需确认镜像构建结果

## 验证记录

- 新增 API 排空 5 项通过；API 全量 655 通过、1 项此前已在旧版本复现的 Windows socket 写阻塞测试失败（`input_plugin_runs_while_a_real_socket_write_is_blocked`）
- gateway-api 全 targets Clippy `-D warnings` 通过；Python 25 项通过
- 独立审查通过；服务器脚本更新前核对原文件哈希，备份后原子替换，`cpr update --check` 通过，未重启容器
- 真实新镜像滚动升级和 live sideband 会话计数尚未运行验收
