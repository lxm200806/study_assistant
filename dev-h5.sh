#!/bin/bash
# 启动前端 H5 开发服务器
# 用法: ./dev-h5.sh  或  npm run dev:h5

set -e
cd "$(dirname "$0")"
source ./scripts/node-env.sh

echo "🚀 启动前端 H5 开发服务器..."
echo "📍 Node: $(command -v node) ($(node --version))"
echo "📂 目录: $(pwd)"
echo "📝 代码修改后会自动刷新"
echo ""

source ./scripts/print-access-urls.sh
print_access_urls 5173 "前端 H5 访问地址"

bash ./scripts/fix-native-deps.sh

exec node ./node_modules/@dcloudio/vite-plugin-uni/bin/uni.js
