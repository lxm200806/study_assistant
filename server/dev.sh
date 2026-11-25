#!/bin/bash
# 启动后端开发服务器（前台运行，自动释放端口；不启动数据库/迁移）
# 用法: ./dev.sh  或  npm run dev
set -e
cd "$(dirname "$0")"

exec node ../scripts/dev.mjs start api --foreground --no-db --no-migrate
