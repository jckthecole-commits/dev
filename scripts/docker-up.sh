#!/usr/bin/env sh
# First deployment with docker compose. The image build prerenders the catalogue,
# so the database must be up and migrated before `build`.
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Create .env from .env.example first."; exit 1; }
docker compose up -d --wait db
docker compose --profile tools build tools
docker compose --profile tools run --rm tools pnpm db:migrate
docker compose --profile tools run --rm tools pnpm db:seed ${SEED_FLAGS:-}
docker compose build app
docker compose up -d app cron
echo "✓ Sifra Vision is running on http://localhost:3000"
echo "  Create the first administrator:"
echo "  docker compose --profile tools run --rm -e ADMIN_PASSWORD=… tools pnpm admin:create --email you@example.com --name \"Your Name\""
