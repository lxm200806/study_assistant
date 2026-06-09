#!/bin/bash
# 重启前端 H5（改 vite 配置、pages.json、依赖等需全量重启时使用）
set -e
cd "$(dirname "$0")"
mkdir -p logs

bash ./stop-client.sh

echo "🔄 重启前端..."
nohup bash ./start-client.sh > logs/client.log 2>&1 &
echo $! > logs/client.pid

for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
    echo "✓ 前端已就绪 http://localhost:5173"
    exit 0
  fi
  sleep 1
done

echo "✗ 前端重启超时，查看 logs/client.log"
exit 1
