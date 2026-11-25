#!/bin/bash
# 打印可访问地址（本机 + 局域网），跨 WSL / Git Bash / Linux

print_access_urls() {
  local port="$1"
  local label="${2:-服务}"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node -e '
    const os = require("os")
    const port = process.argv[1]
    console.log("  本机: http://localhost:" + port)
    for (const list of Object.values(os.networkInterfaces())) {
      for (const item of list || []) {
        if (item.family === "IPv4" && !item.internal) console.log("  局域网: http://" + item.address + ":" + port)
      }
    }
  ' "$port"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}
