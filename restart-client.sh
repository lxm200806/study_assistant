#!/bin/bash
# 重启前端 H5（改 vite / pages.json / 依赖时用）
set -e
cd "$(dirname "$0")"

exec node scripts/dev.mjs restart web
