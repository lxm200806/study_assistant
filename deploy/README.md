# Docker 生产部署

服务器**只需安装 Docker**，无需 Node.js / npm / git clone 后手动装依赖。

## 快速开始

```bash
# 1. 把项目放到服务器（git clone 或 scp 整个目录均可）
git clone https://github.com/lxm200806/study_assistant.git
cd study_assistant

# 2. 配置环境变量
cp .env.prod.example .env.prod
nano .env.prod   # 改密码、JWT、百炼 Key、讯飞 Key 等

# 3. 一键启动（构建在 Docker 内完成）
chmod +x deploy.sh
./deploy.sh
```

浏览器访问：`http://服务器IP`（默认 80 端口）

> `DATABASE_URL` 必须显式填写，compose 不再用 `POSTGRES_PASSWORD` 拼接连接串。
> 密码含 `@ : / # ? &` 等字符时必须先 URL 编码（如 `p@ss` → `p%40ss`），
> 否则 Prisma 会把连接串解析错。

## 架构

| 容器 | 说明 |
|------|------|
| `study-assistant-web` | Nginx，托管 H5 静态页，反代 `/api` |
| `study-assistant-api` | Express 后端，启动时自动 `prisma migrate deploy` |
| `study-assistant-db` | PostgreSQL 16，数据持久化在 volume |

## 常用命令

```bash
# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 仅重启 API（改了 .env.prod 后）
docker compose -f docker-compose.prod.yml up -d --build api

# 停止
docker compose -f docker-compose.prod.yml down

# 停止并删除数据库（慎用）
docker compose -f docker-compose.prod.yml down -v
```

## HTTPS

生产环境语音功能（麦克风）需要 HTTPS。API 容器不再映射宿主机端口，外部只能经
`study-assistant-web`（Nginx）访问，TLS 建议在这一层或宿主机反向代理上终止。
可在宿主机 Nginx/Caddy 前再加一层，或使用 certbot：

```bash
# 示例：宿主机 certbot + 反代到 8080，把 docker-compose 里 HTTP_PORT 改为 8080
sudo certbot --nginx -d your-domain.com
```

Nginx 已内置 gzip、静态资源长缓存、`index.html` no-cache 和基础安全头；
`/api/chat/stream` 单独关闭代理缓冲，其余 API 保持默认缓冲。

## 更新版本

```bash
git pull
./deploy.sh
```

## GitHub Actions 自动构建镜像（可选）

推送 `main` 分支后，`.github/workflows/docker.yml` 会构建镜像并推到 GitHub Container Registry。
PR 只做类型检查、测试和镜像构建，不推送；`main` 推送 `latest` 与 `sha-*` 标签。

服务器拉取预构建镜像（无需本地 build）：

```bash
# .env.prod 可选：IMAGE_TAG=latest 或 git commit sha
# 私有仓库需先 docker login ghcr.io
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

compose 里同时保留了 `build:` 与 `image:`：`up -d --build` 走本地构建，
`pull` 则只拉取 CI 产物、不会重新构建。镜像地址可用 `API_IMAGE` / `WEB_IMAGE` 覆盖，默认是
`ghcr.io/lxm200806/study_assistant/{api,web}:${IMAGE_TAG:-latest}`。
若服务器只允许使用预构建镜像，可把 compose 里的 `build:` 段删掉，避免误触发本地构建。

## 备份与恢复

发布前先备份数据库：

```bash
docker exec study-assistant-db pg_dump -U study -d study_assistant -Fc > backup-$(date +%F).dump
```

恢复（会覆盖现有数据，先停 API）：

```bash
docker compose -f docker-compose.prod.yml stop api
cat backup-YYYY-MM-DD.dump | docker exec -i study-assistant-db pg_restore -U study -d study_assistant --clean --if-exists
docker compose -f docker-compose.prod.yml start api
```

`api` 容器启动时会执行 `prisma migrate deploy`。涉及破坏性迁移时，先备份并在预发环境演练；多实例部署应把迁移拆成独立 job，避免并发迁移。

## 监控与告警

- `GET /health`：进程存活；`GET /ready`：数据库可用且启动同步完成。
- `GET /metrics`：Prometheus 文本格式（请求计数、延迟直方图、进程 uptime）。设置 `METRICS_TOKEN` 后需带 `Authorization: Bearer <token>` 或 `?token=`。
- Docker 日志已限制为 `json-file` 10MB × 3；长期审计请接集中日志。
- 建议告警：`/ready` 连续失败、5xx 比例、`http_request_duration_ms` P95、数据库连接数、磁盘空间。
- 当前没有内置 Sentry/APM；需要时通过环境变量接入，避免把 DSN 写入代码。
