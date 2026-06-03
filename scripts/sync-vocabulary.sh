#!/bin/bash
# 将词库 JSON 同步到 PostgreSQL
set -e
cd "$(dirname "$0")/.."
source ./scripts/node-env.sh

echo "📚 同步词库到数据库..."
cd server
node ./node_modules/ts-node/dist/bin.js -e "
import dotenv from 'dotenv';
dotenv.config();
import { initBooks } from './src/services/book.service';
initBooks().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
"
echo "✓ 词库同步完成"
