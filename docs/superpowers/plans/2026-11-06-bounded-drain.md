# Bounded Drain Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan

**Goal:** 双节点升级不再被共享 Nginx 的长期连接阻塞

**Architecture:** 沿用摘流、固定镜像、逐节点健康验证。只检查目标回环端口的 TCP 连接，默认最多等 60 秒；超时记录剩余连接并继续重建目标节点，不终止 Nginx 进程

**Tech Stack:** Python 标准库、Linux ss、Nginx、Docker Compose

**Spec:** 用户在讨论“无限等待”“直接重启”“限时排空”后要求开始优化，采用限时排空方案；未完成请求可能中断，需要客户端重连或重试

## Global Constraints

- 仅依次处理节点 2、节点 1，不修改其他站点或重启共享 Nginx
- 排空默认 60 秒，可通过 CPR_DRAIN_TIMEOUT 调整
- 探测失败仍取消；另一节点不健康不重建；目标重建失败不处理另一节点
- 宿主脚本需单独部署，不依赖应用镜像构建

## Review Focus

- 其他站点连接不能阻塞目标节点
- 空连接提前完成；持续连接到期后允许重建
- 探测失败不能误认为排空
- 排空后仍需检查另一节点健康
- 保留重建失败摘流及镜像、版本验证

## Task 1: 实现、验证及部署

- [x] 在 deploy/test_rolling_update.py 补充目标端口计数、空连接、自然排空、超时继续、检查失败和另一节点失效测试，运行确认失败
- [x] 修改 deploy/rolling_update.py：target_connections(port) 使用 ss 过滤目标地址与端口；wait_drain(port) 返回剩余数，超时继续；预检验证 ss 可用
- [x] 更新 docs/二次开发与运维手册.md 的默认值、排空行为、依赖与中断边界
- [x] 执行 python -m unittest discover -s deploy -p test_rolling_update.py -v 和 git diff --check，独立审查
- [x] 备份并部署宿主脚本，执行 cpr update，确认两节点镜像与健康

## Verification

- 本地与服务器 Python 测试均为 18/18，通过独立审查和 git diff --check
- 服务器真实 ss 过滤与预检通过；节点 2 提前排空，节点 1 等待 60 秒后带剩余 2 条连接继续重建
- 两节点健康且镜像一致，提交 19731732；Nginx 双节点路由恢复，公网 healthz 返回 204
- 宿主脚本已备份后替换，SHA256 与本地一致；未终止共享 Nginx 进程
