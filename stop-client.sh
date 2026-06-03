#!/bin/bash
# 停止前端客户端（释放 5173 端口）
cd "$(dirname "$0")"
source ./scripts/stop-port.sh
stop_port 5173 "前端 H5"
