#!/bin/bash
# PostgreSQL 公共函数

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-app}"
PG_DB="${PG_DB:-appdb}"
PG_CONTAINER="${PG_CONTAINER:-docker_stack}"

load_pg_from_env() {
  local env_file="${1:-server/.env}"
  if [ ! -f "$env_file" ]; then
    return 0
  fi

  local url
  url=$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -z "$url" ]; then
    return 0
  fi

  # postgresql://user:pass@host:port/db?schema=public
  if [[ "$url" =~ postgresql://([^:/@]+)(:([^@]*))?@([^:/]+)(:([0-9]+))?/([^?]+) ]]; then
    PG_USER="${BASH_REMATCH[1]}"
    PG_HOST="${BASH_REMATCH[4]}"
    PG_PORT="${BASH_REMATCH[6]:-5432}"
    PG_DB="${BASH_REMATCH[7]}"
  fi
}

postgres_port_open() {
  (echo >/dev/tcp/"$PG_HOST"/"$PG_PORT") 2>/dev/null
}

postgres_ready() {
  if ! postgres_port_open; then
    return 1
  fi

  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1 && return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$PG_CONTAINER"; then
      docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1 && return 0
    fi
  fi

  # 端口已监听（如用户自建的 docker_stack），视为可用
  return 0
}

wait_for_postgres() {
  echo "⏳ 等待 PostgreSQL 就绪..."
  for i in $(seq 1 30); do
    if postgres_ready; then
      echo "✓ PostgreSQL 已就绪 (${PG_HOST}:${PG_PORT}/${PG_DB})"
      return 0
    fi
    sleep 1
  done
  echo "✗ PostgreSQL 启动超时" >&2
  return 1
}
