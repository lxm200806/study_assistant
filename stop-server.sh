#!/bin/bash
# 停止后端服务（按进程树回收并释放端口）
cd "$(dirname "$0")"
exec node scripts/dev.mjs stop api
