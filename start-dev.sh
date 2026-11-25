#!/bin/bash
# 同时启动后端（server/.env 的 PORT，默认 3005）与前端 H5（5173）
# 用法: ./start-dev.sh
set -e
cd "$(dirname "$0")"

exec node scripts/dev.mjs start all
