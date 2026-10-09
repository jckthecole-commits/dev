#!/usr/bin/env sh
# Deployment with docker compose — the first one and every update after a `git pull`.
# The image build prerenders the catalogue, so the database must be up, migrated and
# seeded before the app is built. Safe to run again: every step is idempotent.
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "No .env yet — create it with: sh scripts/setup-env.sh"; exit 1; }

# compose reads these from .env as well; the script only needs them for its messages
env_val() { sed -n "s/^$1=//p" .env | tail -n 1 | tr -d '"'; }
DB_PORT=${DB_PORT:-$(env_val DB_PORT)}
APP_PORT=${APP_PORT:-$(env_val APP_PORT)}
SITE=$(env_val NEXT_PUBLIC_SITE_URL)

if ! docker compose up -d --wait --wait-timeout 90 db; then
  docker compose logs --tail 15 db
  echo "✗ PostgreSQL did not start. \"Address in use\" above means port ${DB_PORT:-5432} is taken:"
  echo "  a PostgreSQL installed on the system (sudo systemctl disable --now postgresql), or set DB_PORT=5433 in .env."
  exit 1
fi
docker compose --profile tools build tools
docker compose --profile tools run --rm tools pnpm db:migrate
docker compose --profile tools run --rm tools pnpm db:seed ${SEED_FLAGS:-}
docker compose build app
docker compose up -d app cron

printf 'Starting the site'
i=0
until docker compose exec -T app wget -qO /dev/null "http://127.0.0.1:${APP_PORT:-3000}/robots.txt" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 45 ]; then
    echo
    docker compose logs --tail 25 app
    echo "✗ The site does not answer on port ${APP_PORT:-3000}. \"EADDRINUSE\" above means the port is taken"
    echo "  (a pnpm dev/start still running?) — stop it, or set APP_PORT in .env and the same port in NEXT_PUBLIC_SITE_URL."
    exit 1
  fi
  printf '.'
  sleep 2
done
echo
echo "✓ Sifra Vision is running on ${SITE:-http://localhost:${APP_PORT:-3000}}"
echo "  Create the first administrator:"
echo "  docker compose --profile tools run --rm -e ADMIN_PASSWORD=… tools pnpm admin:create --email you@example.com --name \"Your Name\""
