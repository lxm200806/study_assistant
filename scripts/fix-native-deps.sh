#!/bin/bash
# 补装 Linux 原生二进制（node_modules 曾在 Windows 下安装时需要）
# 用法: ./scripts/fix-native-deps.sh

set -e
cd "$(dirname "$0")/.."
source ./scripts/node-env.sh

install_pkg() {
  local scope="$1"
  local name="$2"
  local version="$3"
  local check_file="$4"
  local install_dir="$5"

  if [ -f "$check_file" ]; then
    return 0
  fi

  echo "→ 安装 ${scope}/${name}@${version}"
  local tmp
  tmp="$(mktemp -d)"
  curl -sL "https://registry.npmjs.org/${scope}/${name}/-/${name}-${version}.tgz" -o "$tmp/pkg.tgz"
  tar -xzf "$tmp/pkg.tgz" -C "$tmp"
  mkdir -p "$(dirname "$install_dir")"
  rm -rf "$install_dir"
  mv "$tmp/package" "$install_dir"
  rm -rf "$tmp"
}

ROLLUP_VER="$(node -p "require('./node_modules/rollup/package.json').version")"
install_pkg "@rollup" "rollup-linux-x64-gnu" "$ROLLUP_VER" \
  "node_modules/@rollup/rollup-linux-x64-gnu/rollup.linux-x64-gnu.node" \
  "node_modules/@rollup/rollup-linux-x64-gnu"

ESBUILD_VER="$(node -p "require('./node_modules/vite/node_modules/esbuild/package.json').version")"
install_pkg "@esbuild" "linux-x64" "$ESBUILD_VER" \
  "node_modules/vite/node_modules/@esbuild/linux-x64/bin/esbuild" \
  "node_modules/vite/node_modules/@esbuild/linux-x64"

echo "✅ 原生依赖已就绪"
