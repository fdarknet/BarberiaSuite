#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Resetting DB (docker compose down -v)"
docker compose down -v

echo "==> Starting containers"
docker compose up -d

echo "==> Installing backend deps"
npm install --prefix backend

echo "==> Pushing schema"
npm run db:push --prefix backend

echo "==> Seeding MINIMAL (1 sucursal, 1 barbero)"
npm run db:seed:min --prefix backend

echo "✅ DB reset done."
