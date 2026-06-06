#!/bin/bash
# 启动后端开发服务器
# 用法: ./dev.sh  或  npm run dev

set -e
cd "$(dirname "$0")"
source ../scripts/node-env.sh

echo "🚀 启动后端开发服务器..."
echo "📍 Node: $(command -v node) ($(node --version))"
echo "📂 目录: $(pwd)"
echo "🌐 API: http://localhost:3004"
echo ""

node ./node_modules/prisma/build/index.js generate

exec node ./node_modules/nodemon/bin/nodemon.js \
  --watch src \
  --watch .env \
  -e ts,json \
  --exec "node ./node_modules/ts-node/dist/bin.js src/app.ts"
