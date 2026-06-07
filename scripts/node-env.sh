#!/bin/bash
# 优先使用 WSL 原生 Node.js（/usr/bin/node），避免误用 Windows 或 Cursor 内置 Node
export PATH="/usr/local/bin:/usr/bin:${PATH}"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请安装: sudo apt install -y nodejs npm" >&2
  exit 1
fi

if [[ "$(command -v node)" == *"/mnt/c/"* ]] || [[ "$(command -v node)" == *".exe" ]]; then
  echo "检测到 Windows 版 Node，请确保 WSL 中已安装 nodejs 且 PATH 正确" >&2
  exit 1
fi
