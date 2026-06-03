#!/bin/bash
# 同时启动后端 (3004) 与前端 (5173)，便于本地测试
# 用法: ./start-dev.sh
set -e
cd "$(dirname "$0")"

source ./scripts/node-env.sh
source ./scripts/stop-port.sh
source ./scripts/postgres-common.sh
load_pg_from_env "server/.env"

mkdir -p logs

echo "🐘 检查数据库..."
bash ./scripts/start-db.sh
bash ./scripts/db-migrate.sh

stop_port 3004 "后端 API"
stop_port 5173 "前端 H5"

echo ""
echo "🚀 启动后端..."
cd server
nohup npm run dev > ../logs/server.log 2>&1 &
echo $! > ../logs/server.pid
cd ..

echo "⏳ 等待后端就绪..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3004/api/books >/dev/null 2>&1; then
    echo "✓ 后端已就绪 (http://localhost:3004)"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "✗ 后端启动超时，查看 logs/server.log"
    exit 1
  fi
  sleep 1
done

echo ""
echo "🚀 启动前端..."
nohup npm run dev:h5 > logs/client.log 2>&1 &
echo $! > logs/client.pid

echo "⏳ 等待前端就绪..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
    echo "✓ 前端已就绪 (http://localhost:5173)"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "✗ 前端启动超时，查看 logs/client.log"
    exit 1
  fi
  sleep 1
done

echo ""
source ./scripts/print-access-urls.sh
print_access_urls 5173 "前端 H5 访问地址"
echo "📖 API 文档: http://localhost:3004/api-docs"
echo "📋 日志: logs/server.log  logs/client.log"
echo ""
