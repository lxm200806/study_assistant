#!/bin/bash
# Node 环境检查
#
# - Linux/WSL：优先使用系统 Node（/usr/local/bin:/usr/bin），避免误用 Cursor 内置 Node
# - Git Bash / MSYS / MINGW / Cygwin：本仓库直接用 Windows 原生 Node 开发，只校验可用性

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请安装 Node 20+ 并确保在 PATH 中" >&2
  exit 1
fi

case "$(uname -s 2>/dev/null)" in
  MSYS_NT*|MINGW*|CYGWIN*)
    export PATH="/usr/local/bin:/usr/bin:${PATH}"
    if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then return 0; else exit 0; fi
    ;;
esac

export PATH="/usr/local/bin:/usr/bin:${PATH}"

if [[ "$(command -v node)" == *"/mnt/c/"* ]] || [[ "$(command -v node)" == *".exe" ]]; then
  echo "检测到 Windows 版 Node，但当前是 WSL 环境；请安装 WSL 内原生 nodejs 并调整 PATH" >&2
  exit 1
fi
