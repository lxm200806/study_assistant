#!/bin/bash
# 打印 WSL 开发环境的访问地址（供 Windows 浏览器使用）

print_access_urls() {
  local port="$1"
  local label="$2"
  local wsl_ip

  wsl_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  推荐: http://localhost:$port"
  if [ -n "$wsl_ip" ]; then
    echo "  备用: http://${wsl_ip}:$port"
  fi
  echo ""
  echo "  API 已通过 Vite 代理到后端，无需单独访问 3004"
  echo "  请优先使用 http://localhost:$port（Windows 浏览器访问 WSL 最稳定）"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}
