#!/bin/bash
# 原生依赖检查（不再从网络下载固定平台 tgz）
#
# 历史实现会硬编码下载 Linux x64 的 rollup/esbuild 二进制且无校验和，
# 在 ARM、依赖提升或 npm ci 之后反而会破坏 node_modules。
# 现在只做检查，平台二进制交给 npm 的可选依赖。

set -e
cd "$(dirname "$0")/.."

if command -v node >/dev/null 2>&1; then
  echo "✅ Node $(node --version)（$(node -p 'process.platform + "-" + process.arch')）"
else
  echo "未找到 Node.js" >&2
  exit 1
fi

cat <<'EOF'
原生依赖（rollup / esbuild）由 npm 的可选平台包自动安装。
如切换平台后出现 "Cannot find module @rollup/rollup-*"：
  rm -rf node_modules package-lock.json && npm install
不要再手工下载固定 Linux x64 二进制。
EOF
