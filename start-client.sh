#!/bin/bash
# 启动前端客户端（启动前先释放 5173 端口）
# 用法: ./start-client.sh

set -e
cd "$(dirname "$0")"

source ./scripts/node-env.sh
source ./scripts/stop-port.sh

stop_port 5173 "前端 H5"

echo ""
echo "🚀 启动前端客户端..."
echo ""

source ./scripts/print-access-urls.sh
print_access_urls 5173 "前端 H5 访问地址"
echo ""

exec npm run dev:h5
