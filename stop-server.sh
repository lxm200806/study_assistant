#!/bin/bash
# 停止后端服务（释放 3005 端口）
cd "$(dirname "$0")"
source ./scripts/stop-port.sh
stop_port 3005 "后端 API"
