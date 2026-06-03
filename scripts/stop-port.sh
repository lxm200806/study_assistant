#!/bin/bash
# 释放指定 TCP 端口
# 用法: stop_port 3004 "后端"

stop_port() {
  local port="$1"
  local label="${2:-服务}"

  local pids
  pids="$(lsof -t -i:"$port" -sTCP:LISTEN 2>/dev/null || true)"

  if [ -z "$pids" ]; then
    echo "✓ 端口 $port ($label) 未被占用"
    return 0
  fi

  echo "→ 停止占用 $port 端口的进程 ($label)..."
  kill $pids 2>/dev/null || true
  sleep 1

  pids="$(lsof -t -i:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
    sleep 0.5
  fi

  if lsof -t -i:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ 端口 $port 仍被占用，请手动检查: lsof -i:$port" >&2
    exit 1
  fi

  echo "✓ 端口 $port 已释放"
}
