# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# PostgreSQL 服务端镜像：备份客户端（pg_dump/pg_restore）从这里取，与 compose 同源、
# 版本严格一致。升级数据库版本时只需同步修改这里与 deploy/compose.yaml。
ARG POSTGRES_IMAGE=postgres:18-bookworm@sha256:bbf83594798e144bff365a9c191c5d779f181fb3135902064ab8ff11918020fc

FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68 AS frontend-builder

WORKDIR /app
COPY modules/ui ./modules/ui
COPY frontend ./frontend
WORKDIR /app/frontend
RUN if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then \
      npm install --global "$(node -p 'require("./package.json").packageManager')" && \
      cd ../modules/ui && pnpm install --no-frozen-lockfile && pnpm build && \
      cd ../../frontend && pnpm install --no-frozen-lockfile && pnpm build; \
    fi

FROM rust:1.99.1-bookworm@sha256:9181b56c2a21ab1d5e73cffe04fc762426d30aa7fac3c91141dd033f49a7fc8b AS backend-builder

WORKDIR /app/backend
ARG TARGETARCH
ARG CPR_VERSION=
ARG CPR_GIT_SHA=unknown
ARG CPR_BUILD_TIME=unknown
ARG CPR_BUILD_TYPE=release
ENV CARGO_TARGET_DIR=/app/backend/target/${TARGETARCH}
ENV CPR_VERSION=${CPR_VERSION}
ENV CPR_GIT_SHA=${CPR_GIT_SHA}
ENV CPR_BUILD_TIME=${CPR_BUILD_TIME}
ENV CPR_BUILD_TYPE=${CPR_BUILD_TYPE}
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/apps ./apps
COPY backend/crates ./crates
COPY backend/migrations ./migrations
COPY release/version.yaml /app/release/version.yaml
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/backend/target \
    version="${CPR_VERSION:-$(sed -n 's/^version:[[:space:]]*//p' /app/release/version.yaml)}" \
    && version="$(printf '%s' "$version" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^v*//')" \
    && test -n "$version" \
    && CPR_VERSION="$version" cargo build --release --locked --bin codex-proxy-rs \
    && cp "${CARGO_TARGET_DIR}/release/codex-proxy-rs" /tmp/codex-proxy-rs \
    && printf '%s' "$version" > /tmp/cpr-version

# 备份客户端来源：与 compose 服务端同一固定镜像，版本一致。
FROM ${POSTGRES_IMAGE} AS pg-client

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS runtime-base

ENV TZ=UTC

# 运行时基础只从 Debian 官方源补 libpq（pg_dump 的动态依赖；ABI 兼容，无需引入第三方
# APT 源）。pg_dump/pg_restore 二进制由 pg-client stage COPY，构建期不依赖运行时安装。
# 更新基础镜像已有的系统包，使固定 digest 的镜像也能获取 Debian 安全更新。
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl tzdata libpq5 \
    && install -d /usr/lib/postgresql/18/bin \
    && ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime \
    && printf '%s\n' "${TZ}" > /etc/timezone \
    && groupadd --system --gid 10001 cpr \
    && useradd --system --uid 10001 --gid cpr --home-dir /app --shell /usr/sbin/nologin cpr \
    && install -d -o cpr -g cpr \
        /app/bin /app/deploy /app/.runtime/data /app/.runtime/logs /app/web \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pg-client /usr/lib/postgresql/18/bin/pg_dump /usr/lib/postgresql/18/bin/pg_dump
COPY --from=pg-client /usr/lib/postgresql/18/bin/pg_restore /usr/lib/postgresql/18/bin/pg_restore
RUN /usr/lib/postgresql/18/bin/pg_dump --version \
    && /usr/lib/postgresql/18/bin/pg_restore --version

WORKDIR /app
ENV CPR_DEPLOYMENT_MODE=docker
ENV PATH="/app/bin:/usr/lib/postgresql/18/bin:${PATH}"

EXPOSE 8080

# 首次升级的历史请求迁移需要启动宽限期
HEALTHCHECK --interval=30s --timeout=5s --start-period=5m --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

CMD ["/app/bin/codex-proxy-rs"]

FROM runtime-base AS runtime

ARG CPR_GIT_SHA=unknown

COPY --from=backend-builder --chown=cpr:cpr /tmp/codex-proxy-rs /app/bin/codex-proxy-rs
COPY --from=backend-builder /tmp/cpr-version /tmp/cpr-version
COPY --from=frontend-builder --chown=cpr:cpr /app/frontend/dist ./web/dist

# 编译与发行清单使用同一份已解析版本，源码构建不要求调用方传 CPR_VERSION
RUN version="$(cat /tmp/cpr-version)" && test -n "$version" && rm /tmp/cpr-version && mkdir -p /app/bin/plugins/official &&     printf '{\n  "schema_version": 1,\n  "sealed": true,\n  "gateway_version": "%s",\n  "gateway_git_sha": "%s",\n  "plugin_host": {\n    "schema_version": 2,\n    "manifest_schema_versions": [2],\n    "protocol_versions": [7],\n    "capabilities": [\n      { "capability": "frontend_authentication", "versions": [2] },\n      { "capability": "scheduler", "versions": [3] },\n      { "capability": "model_router", "versions": [2] },\n      { "capability": "model_catalog", "versions": [2] },\n      { "capability": "retry_policy", "versions": [2] },\n      { "capability": "middleware", "versions": [6] },\n      { "capability": "upstream_adapter", "versions": [5] },\n      { "capability": "observer", "versions": [2] },\n      { "capability": "command_line", "versions": [1] },\n      { "capability": "management", "versions": [2] },\n      { "capability": "maintenance", "versions": [1] }\n    ]\n  },\n  "plugins": []\n}\n' "$version" "$CPR_GIT_SHA" > /app/bin/plugins/official/plugin-release-manifest.json &&     chmod 0444 /app/bin/plugins/official/plugin-release-manifest.json &&     chmod 0555 /app/bin/plugins/official &&     chmod 0755 /app/bin/plugins &&     chown -R cpr:cpr /app/bin/plugins

USER cpr

FROM runtime-base AS runtime-prebuilt

ARG TARGETARCH
ARG CPR_PREBUILT_DIR=dist/docker

COPY --chown=cpr:cpr ${CPR_PREBUILT_DIR}/linux-${TARGETARCH}/codex-proxy-rs /app/bin/codex-proxy-rs
COPY --chown=cpr:cpr ${CPR_PREBUILT_DIR}/web/dist ./web/dist
COPY --chown=cpr:cpr ${CPR_PREBUILT_DIR}/linux-${TARGETARCH}/plugins/official /app/bin/plugins/official
RUN chmod +x /app/bin/codex-proxy-rs \
    && find /app/bin/plugins/official -type f -exec chmod 0444 '{}' + \
    && chmod 0555 /app/bin/plugins/official \
    && chmod 0755 /app/bin/plugins
USER cpr
