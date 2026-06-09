#!/bin/bash
# 重启后端（改 server/ 或 server/.env 后使用）
set -e
cd "$(dirname "$0")"
mkdir -p logs

bash ./stop-server.sh

echo "🔄 重启后端..."
nohup bash ./start-server.sh > logs/server.log 2>&1 &
echo $! > logs/server.pid

for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3005/api/books >/dev/null 2>&1; then
    echo "✓ 后端已就绪 http://localhost:3005"
    exit 0
  fi
  sleep 1
done

echo "✗ 后端重启超时，查看 logs/server.log"
exit 1
