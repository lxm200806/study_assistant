#!/bin/sh
set -e

echo "→ Running database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "→ Starting API on port ${PORT:-3004}..."
exec node dist/app.js
