#!/bin/bash
# 在 WSL 中安装并配置原生 PostgreSQL（无需 Docker）
# 用法: ./scripts/setup-postgres-wsl.sh

set -e
cd "$(dirname "$0")/.."

PG_USER="study"
PG_PASSWORD="study123"
PG_DB="study_assistant"

echo "📦 安装 PostgreSQL（WSL 原生）..."
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

echo "🚀 启动 PostgreSQL 服务..."
sudo service postgresql start

echo "👤 创建数据库用户和库..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASSWORD}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};"

echo ""
echo "✅ PostgreSQL 安装完成"
echo "   连接: postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5432/${PG_DB}"
echo ""
echo "下一步: ./scripts/db-migrate.sh && ./start-server.sh"
