# Fork Update Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task.

**Goal:** 展示自己的成功镜像构建与独立的上游版本动态，Docker 只通过服务器滚动升级

**Architecture:** Host 查询配置仓库的 main 分支 docker.yml 成功运行，以提交关系判断更新；上游 Release 单独查询且不作为安装候选。API 返回类型化信息，管理端展示两个来源。Docker 后端拒绝程序包更新与回滚，页面提供复制 cpr update。

**Tech Stack:** Rust、reqwest、GitHub REST API、Vue、现有 SystemUpdate 接口

**Spec:** 本文记录用户已确认的方案；用户已要求开始实施、验证、提交推送及滚动部署

## Global Constraints

- 自己的仓库为 wuwei0727/codex-proxy-rs，上游为 zyycn/codex-proxy-rs
- Docker 不授予网页宿主机控制权限，不下载上游程序包
- 只报告成功构建；查询失败、无构建、未知提交与历史回退不能显示为可升级
- 镜像检查采用成功构建提交号；不把 GitHub Release 版本当作镜像版本

## Review Focus

- 当前提交高于远端成功构建时不得建议降级
- 上游查询失败不能抹除自己的构建结果
- Docker 更新与回滚 API 均拒绝且无文件写入
- 旧客户端仍可读取新增字段，非 Docker 保持现有更新流程
- 明暗主题、检查失败与无构建结果均可理解

## Tasks

- [x] 核对两个线上节点的配置与构建版本
- [x] Host 增加 Docker 构建查询与缓存，扩展 Admin/API 更新详情字段
- [x] 测试成功构建、提交相同/领先/分叉、来源失败隔离及 Docker 安装拒绝
- [x] 前端新增 Docker 更新内容，保留非 Docker 页面；补齐三语文案
- [x] 更新 API、部署及二次开发运维说明
- [x] 运行后端针对性验证、前端构建和界面验证；最终审查
- [ ] 提交推送，等待镜像构建成功后执行 cpr update 并确认两个节点健康

## Verification

- 74 个 Host 更新测试通过，API 测试目标编译通过，Host/Admin/API Clippy 无警告
- 前端生产构建通过，本次 Vue/TypeScript ESLint 通过；语言包规则存在跨文件缺失键误报，未修改全局规则
- 真实弹窗以明确标注的模拟数据验证深色、浅色窄屏、错误状态、检查和复制按钮；未使用模拟数据验证线上接口
- 独立审查无必须修复问题，补齐无构建、未知提交、相同提交、失败刷新和上游隔离测试
- 本 fork 的默认发行源统一为自己的仓库，非 Docker 保留 Release 安装流程
