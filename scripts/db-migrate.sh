#!/bin/bash
# 执行数据库迁移
# 用法: ./scripts/db-migrate.sh

set -e
cd "$(dirname "$0")/.."
source ./scripts/node-env.sh

if [ ! -f server/.env ]; then
  echo "请先复制 server/.env.example 为 server/.env" >&2
  exit 1
fi

cd server
node ./node_modules/prisma/build/index.js generate
node ./node_modules/prisma/build/index.js migrate deploy
echo "✓ 数据库迁移完成"
