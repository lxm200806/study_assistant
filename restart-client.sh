#!/bin/bash
# 重启前端 H5（改 vite / pages.json / 依赖时用）
# 用独立进程组启动，避免 Agent/终端退出后 5173 又没了
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
mkdir -p logs

bash ./stop-client.sh

echo "🔄 重启前端..."
: > logs/client.log

# macOS 无 setsid：Python start_new_session 脱离当前进程组
ROOT="$ROOT" python3 <<'PY'
import os, subprocess
from pathlib import Path
root = Path(os.environ["ROOT"])
log = open(root / "logs" / "client.log", "a", buffering=1)
proc = subprocess.Popen(
    ["bash", str(root / "start-client.sh")],
    cwd=str(root),
    stdin=subprocess.DEVNULL,
    stdout=log,
    stderr=subprocess.STDOUT,
    start_new_session=True,
)
(root / "logs" / "client.pid").write_text(str(proc.pid))
print(proc.pid)
PY

for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
    echo "✓ 前端已就绪 http://localhost:5173"
    exit 0
  fi
  sleep 1
done

echo "✗ 前端重启超时，查看 logs/client.log"
tail -40 logs/client.log || true
exit 1
