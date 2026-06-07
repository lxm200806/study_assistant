#!/bin/bash
# 启动后端服务（启动前先释放 3005 端口）
# 用法: ./start-server.sh
set -e
cd "$(dirname "$0")"
source ./scripts/node-env.sh
source ./scripts/stop-port.sh
source ./scripts/postgres-common.sh
load_pg_from_env "server/.env"

bash ./scripts/start-db.sh
bash ./scripts/db-migrate.sh
stop_port 3005 "后端 API"

echo ""
echo "🚀 启动后端服务..."
echo ""

source ./scripts/print-access-urls.sh
print_access_urls 3005 "后端 API 访问地址"
echo "📖 API 文档: http://localhost:3005/api-docs"
echo "🐘 数据库: PostgreSQL ${PG_HOST:-localhost}:${PG_PORT:-5432}/${PG_DB:-appdb}"
echo ""

cd server
exec npm run dev
