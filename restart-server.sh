#!/bin/bash
# 重启后端（改 server/ 或 server/.env 后使用）
set -e
cd "$(dirname "$0")"
mkdir -p logs

bash ./stop-server.sh

echo "🔄 重启后端..."
# 用独立会话启动，避免被 Cursor agent 结束时连带杀掉（否则登录会 request:fail）
python3 - <<'PY'
import os, subprocess
from pathlib import Path
root = Path.cwd()
log = open(root / "logs" / "server.log", "a", buffering=1)
proc = subprocess.Popen(
    ["bash", str(root / "start-server.sh")],
    cwd=str(root),
    stdout=log,
    stderr=subprocess.STDOUT,
    start_new_session=True,
    close_fds=True,
)
(root / "logs" / "server.pid").write_text(str(proc.pid) + "\n")
print(proc.pid)
PY

for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3005/api/books >/dev/null 2>&1; then
    echo "✓ 后端已就绪 http://localhost:3005"
    exit 0
  fi
  sleep 1
done

echo "✗ 后端重启超时，查看 logs/server.log"
exit 1
