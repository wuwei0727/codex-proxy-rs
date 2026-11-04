#!/usr/bin/env bash
# Codex Proxy 快捷运维管理工具 (cpr)

INSTALL_DIR="${CPR_INSTALL_DIR:-}"

# 自动推导安装路径
if [[ -z "$INSTALL_DIR" ]]; then
  if [[ -f "/root/codex-proxy-rs/deploy/compose.yaml" ]]; then
    INSTALL_DIR="/root/codex-proxy-rs"
  elif [[ -f "$PWD/deploy/compose.yaml" ]]; then
    INSTALL_DIR="$PWD"
  elif [[ -f "$HOME/codex-proxy-rs/deploy/compose.yaml" ]]; then
    INSTALL_DIR="$HOME/codex-proxy-rs"
  else
    # 查找可能的目录
    found=$(find /root /home /opt -maxdepth 3 -name "compose.yaml" 2>/dev/null | grep "codex-proxy-rs/deploy/compose.yaml" | head -n 1 || true)
    if [[ -n "$found" ]]; then
      INSTALL_DIR="$(dirname "$(dirname "$found")")"
    else
      INSTALL_DIR="/root/codex-proxy-rs"
    fi
  fi
fi

DEPLOY_DIR="${INSTALL_DIR}/deploy"
COMPOSE_FILE="${DEPLOY_DIR}/compose.yaml"
CONFIG_FILE="${DEPLOY_DIR}/config.yaml"

GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
CYAN='\033[1;36m'
BLUE='\033[1;34m'
NC='\033[0m'

check_env() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo -e "${RED}[错误] 未找到 compose.yaml，当前路径：${INSTALL_DIR}${NC}"
    echo -e "${YELLOW}请确认 Codex Proxy 是否已安装，或者通过环境变量指定：export CPR_INSTALL_DIR=/你的安装路径${NC}"
    exit 1
  fi
}

cpr_status() {
  check_env
  echo -e "${CYAN}==> 容器运行状态：${NC}"
  docker compose -f "$COMPOSE_FILE" ps
}

cpr_logs() {
  check_env
  local target="${1:-codex-proxy-rs}"
  if [[ "$target" == "all" ]]; then
    echo -e "${CYAN}==> 查看全部服务实时日志 (Ctrl+C 退出)...${NC}"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
  else
    echo -e "${CYAN}==> 查看 ${target} 实时日志 (Ctrl+C 退出)...${NC}"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "$target"
  fi
}

cpr_restart() {
  check_env
  local target="${1:-}"
  if [[ -n "$target" ]]; then
    echo -e "${CYAN}==> 正在重启 ${target}...${NC}"
    docker compose -f "$COMPOSE_FILE" restart "$target"
  else
    echo -e "${CYAN}==> 正在重启所有服务...${NC}"
    docker compose -f "$COMPOSE_FILE" restart
  fi
  echo -e "${GREEN}==> 重启完成！${NC}"
}

cpr_start() {
  check_env
  echo -e "${CYAN}==> 正在启动服务...${NC}"
  docker compose -f "$COMPOSE_FILE" up -d
  echo -e "${GREEN}==> 启动完成！${NC}"
}

cpr_stop() {
  check_env
  echo -e "${CYAN}==> 正在停止服务...${NC}"
  docker compose -f "$COMPOSE_FILE" stop
  echo -e "${GREEN}==> 服务已停止！${NC}"
}

cpr_update() {
  check_env
  if grep -q "ghcr.io/zyycn/codex-proxy-rs" "$COMPOSE_FILE" 2>/dev/null; then
    echo -e "${YELLOW}==> 检测到旧镜像源，正在自动切换为你的专属镜像 (wuwei0727)...${NC}"
    sed -i 's|ghcr.io/zyycn/codex-proxy-rs|ghcr.io/wuwei0727/codex-proxy-rs|g' "$COMPOSE_FILE"
  fi
  echo -e "${CYAN}==> 正在拉取最新 Docker 镜像...${NC}"
  docker compose -f "$COMPOSE_FILE" pull codex-proxy-rs
  echo -e "${CYAN}==> 正在平滑更新服务...${NC}"
  docker compose -f "$COMPOSE_FILE" up -d codex-proxy-rs
  echo -e "${GREEN}==> 更新完成！当前最新状态：${NC}"
  docker compose -f "$COMPOSE_FILE" ps
}

cpr_info() {
  check_env
  echo -e "${GREEN}=============================================${NC}"
  echo -e "${GREEN}       Codex Proxy 配置与登录信息            ${NC}"
  echo -e "${GREEN}=============================================${NC}"
  local ip
  ip=$(curl -s4 ifconfig.me 2>/dev/null || curl -s4 api.ipify.org 2>/dev/null || echo "127.0.0.1")
  echo -e "访问地址：      ${CYAN}http://${ip}:8080${NC} (本地: http://127.0.0.1:8080)"
  echo -e "管理员用户名：  ${CYAN}admin@cpr.local${NC}"
  
  if [[ -f "$CONFIG_FILE" ]]; then
    local admin_pwd
    admin_pwd=$(grep -A 5 "admin_credentials:" "$CONFIG_FILE" 2>/dev/null | grep "password:" | head -n 1 | awk '{print $2}' | tr -d '"\r' || true)
    if [[ -n "$admin_pwd" ]]; then
      echo -e "管理员密码：    ${YELLOW}${admin_pwd}${NC}"
    else
      echo -e "管理员密码：    ${YELLOW}请在 ${CONFIG_FILE} 中查看${NC}"
    fi
  fi
  echo -e "安装目录：      ${INSTALL_DIR}"
  echo -e "配置文件：      ${CONFIG_FILE}"
  echo -e "${GREEN}=============================================${NC}"
}

show_menu() {
  clear
  echo -e "${GREEN}=============================================${NC}"
  echo -e "${GREEN}        Codex Proxy 快捷管理菜单 (cpr)       ${NC}"
  echo -e "${GREEN}=============================================${NC}"
  echo -e " ${GREEN}1.${NC} 查看运行状态"
  echo -e " ${GREEN}2.${NC} 查看实时日志 (主网关)"
  echo -e " ${GREEN}3.${NC} 查看全部实时日志 (包含数据库与Redis)"
  echo -e " ${GREEN}4.${NC} 重启服务"
  echo -e " ${GREEN}5.${NC} 启动服务"
  echo -e " ${GREEN}6.${NC} 停止服务"
  echo -e " ${GREEN}7.${NC} 一键升级更新 (拉取最新镜像平滑重启)"
  echo -e " ${GREEN}8.${NC} 查看登录地址与管理员密码"
  echo -e " ${GREEN}0.${NC} 退出菜单"
  echo -e "${GREEN}=============================================${NC}"
  read -r -p "请输入选项 [0-8]: " choice
  case "$choice" in
    1) cpr_status ;;
    2) cpr_logs "codex-proxy-rs" ;;
    3) cpr_logs "all" ;;
    4) cpr_restart ;;
    5) cpr_start ;;
    6) cpr_stop ;;
    7) cpr_update ;;
    8) cpr_info ;;
    0) exit 0 ;;
    *) echo -e "${RED}输入无效，请重新输入${NC}" ;;
  esac
}

case "${1:-}" in
  status|ps)
    cpr_status
    ;;
  log|logs)
    cpr_logs "${2:-codex-proxy-rs}"
    ;;
  restart)
    cpr_restart "${2:-}"
    ;;
  start)
    cpr_start
    ;;
  stop)
    cpr_stop
    ;;
  update|upgrade)
    cpr_update
    ;;
  info)
    cpr_info
    ;;
  help|-h|--help)
    echo "使用方法: cpr [命令]"
    echo ""
    echo "可用命令:"
    echo "  cpr          打开交互式菜单"
    echo "  cpr status   查看运行状态"
    echo "  cpr logs     查看主服务日志"
    echo "  cpr restart  重启所有服务"
    echo "  cpr start    启动所有服务"
    echo "  cpr stop     停止所有服务"
    echo "  cpr update   一键平滑升级至最新版本"
    echo "  cpr info     查看后台地址与管理员账号密码"
    ;;
  *)
    show_menu
    ;;
esac
