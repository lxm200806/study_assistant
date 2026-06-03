#!/bin/bash
# 停止后端服务（释放 3004 端口）
cd "$(dirname "$0")"
source ./scripts/stop-port.sh
stop_port 3004 "后端 API"
