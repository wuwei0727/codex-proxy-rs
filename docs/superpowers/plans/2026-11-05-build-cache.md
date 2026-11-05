# 镜像构建缓存优化

目标：跨 GitHub Actions runner 复用 Cargo 编译依赖，减少无关镜像构建，不更改运行代码或 release 优化级别

方案：保留 Docker 构建，通过固定提交的 buildkit-cache-dance 保存三个 Cargo cache mount，使用 actions/cache 跨任务恢复；pnpm 下载缓存由 setup-node 管理。按工具链、Cargo.lock、Dockerfile 和平台隔离缓存，每个提交保存一次。提交和构建时间仍真实注入，宿主模块可能重新编译及链接

相比迁移为宿主机编译，此方案保留现有 Linux 构建环境及打包流程，改动较小。首次运行建立缓存，后续耗时必须通过实测确认；不保证前端修改时整个后端构建步骤跳过

- [x] 收窄 push paths，保留子模块指针、构建脚本和镜像输入的触发
- [x] 配置 Cargo 和 pnpm 缓存，排除缓存目录进入 Docker context
- [x] Actionlint 与配置检查，更新运维手册，独立审查并推送
- [ ] 检查云端冷缓存构建与后续缓存命中运行，记录实际结果

静态验证：Actionlint 1.7.7、git diff --check 和应用/宿主文件触发路径检查通过。独立审查发现 Action 标签对象不能代替提交，已固定到解引用后的 v3.3.0 提交。首次构建正在建立缓存，暂不宣称提速比例。
