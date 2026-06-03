#!/bin/bash
# 启动 PostgreSQL（优先使用已有 Docker 容器/镜像，无需重新拉取）
# 用法: ./scripts/start-db.sh

set -e
cd "$(dirname "$0")/.."
source ./scripts/postgres-common.sh
load_pg_from_env "server/.env"

CONTAINER="$PG_CONTAINER"

# 已在运行
if postgres_ready; then
  echo "✓ PostgreSQL 已在运行 (${PG_HOST}:${PG_PORT}/${PG_DB})"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  echo "🐘 启动 PostgreSQL（Docker）..."

  # 1. 已有本项目容器（含已停止）→ 直接启动，不 pull
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
    echo "→ 发现已有容器 $CONTAINER"
    docker start "$CONTAINER" 2>/dev/null || true
    if wait_for_postgres; then
      exit 0
    fi
  fi

  # 2. 本项目 compose 容器 study-assistant-db
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "study-assistant-db"; then
    echo "→ 发现容器 study-assistant-db"
    docker start study-assistant-db 2>/dev/null || docker compose up -d postgres
    if wait_for_postgres; then
      exit 0
    fi
  fi

  # 3. 本地已有 postgres 镜像 → compose up，不 pull
  if docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -qiE 'postgres(:|$)'; then
    echo "→ 使用本地已有 PostgreSQL 镜像"
    docker compose up -d postgres 2>/dev/null || true
    if wait_for_postgres; then
      exit 0
    fi
  fi

  echo ""
  echo "⚠️  无法通过 Docker 启动 PostgreSQL 容器" >&2
fi

# 尝试 WSL 原生 PostgreSQL
if command -v pg_ctlcluster >/dev/null 2>&1 || [ -d /etc/postgresql ]; then
  echo "🐘 检测到 WSL 原生 PostgreSQL，正在启动..."
  sudo service postgresql start 2>/dev/null || true
  if wait_for_postgres; then
    exit 0
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PostgreSQL 未就绪，请检查："
echo ""
echo "  1. 确认数据库容器在运行："
echo "     docker ps"
echo "     docker start $CONTAINER"
echo ""
echo "  2. 核对 server/.env 中的 DATABASE_URL"
echo "     当前期望: postgresql://${PG_USER}:***@${PG_HOST}:${PG_PORT}/${PG_DB}"
echo ""
echo "  3. 无 Docker 镜像时可运行: ./scripts/setup-postgres-wsl.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exit 1
