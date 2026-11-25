#!/bin/bash
# 重启后端（改 server/ 或 server/.env 后使用）
set -e
cd "$(dirname "$0")"

exec node scripts/dev.mjs restart api
