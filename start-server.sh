#!/bin/bash
# 前台启动后端（自动释放端口、prisma generate + migrate deploy）
# 用法: ./start-server.sh
set -e
cd "$(dirname "$0")"

exec node scripts/dev.mjs start api --foreground
