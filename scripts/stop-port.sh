#!/bin/bash
# 释放指定 TCP 端口（跨平台：Windows netstat + taskkill；POSIX ss/lsof）
# 用法: source scripts/stop-port.sh && stop_port 3005 "后端"
#
# 实际逻辑在 scripts/dev.mjs；保留该文件兼容旧的 source 调用。

stop_port() {
  local port="$1"
  local label="${2:-服务}"
  node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/dev.mjs" kill-port "$port" "$label"
}
