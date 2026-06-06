#!/bin/bash
# One-command production deploy (Docker only — no npm on host).
# Usage:
#   cp .env.prod.example .env.prod   # edit secrets first
#   ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.prod}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy from .env.prod.example and edit it." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install: https://docs.docker.com/engine/install/" >&2
  exit 1
fi

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

echo "→ Building and starting production stack..."
$COMPOSE -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --build

echo ""
echo "✓ Deployed. Open http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_SERVER_IP')"
echo "  Logs: $COMPOSE -f docker-compose.prod.yml logs -f"
echo "  Stop: $COMPOSE -f docker-compose.prod.yml down"
