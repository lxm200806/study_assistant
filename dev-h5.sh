#!/bin/bash
# 启动前端 H5 开发服务器（前台运行，自动释放 5173）
# 用法: ./dev-h5.sh  或  npm run dev:h5
set -e
cd "$(dirname "$0")"

exec node scripts/dev.mjs start web --foreground
