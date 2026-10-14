#!/bin/sh
set -eu

echo "Running database migrations..."
cd /app/packages/db
pnpm db:migrate

echo "Starting API server..."
cd /app/apps/api
exec node index.cjs
