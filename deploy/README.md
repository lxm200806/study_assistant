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

生产环境语音功能需要 HTTPS。可在宿主机 Nginx/Caddy 前再加一层，或使用 certbot：

```bash
# 示例：宿主机 certbot + 反代到 8080，把 docker-compose 里 HTTP_PORT 改为 8080
sudo certbot --nginx -d your-domain.com
```

## 更新版本

```bash
git pull
./deploy.sh
```

## GitHub Actions 自动构建镜像（可选）

推送 `main` 分支后，`.github/workflows/docker.yml` 会构建镜像并推到 GitHub Container Registry。

服务器拉取预构建镜像（无需本地 build）：

```bash
# .env.prod 里可设 IMAGE_TAG=latest
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

（需在 compose 里改用 `image:` 而非 `build:`，见 workflow 注释。）
