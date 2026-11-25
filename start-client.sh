#!/bin/bash
# 前台启动前端 H5（自动释放 5173）
# 用法: ./start-client.sh
set -e
cd "$(dirname "$0")"

exec node scripts/dev.mjs start web --foreground
