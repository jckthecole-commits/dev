#!/usr/bin/env sh
# Creates .env from .env.example with fresh secrets.
#   sh scripts/setup-env.sh                        → site on http://localhost:3000
#   sh scripts/setup-env.sh http://192.168.1.50:3000   (the address you open in the browser)
#   sh scripts/setup-env.sh https://sifravision.ro
# The site address is baked into the build and is the only origin the login accepts:
# change it → run the build again.
set -eu
cd "$(dirname "$0")/.."
SITE="${1:-http://localhost:3000}"
if [ -f .env ]; then
  echo ".env already exists — remove it first if you want a new one."
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl is needed (sudo apt install openssl)"; exit 1; }
cp .env.example .env
set_var() { sed -i "s|^$1=.*|$1=$2|" .env; }
set_var NEXT_PUBLIC_SITE_URL "$SITE"
set_var BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
set_var DATA_ENCRYPTION_KEY "$(openssl rand -base64 32)"
set_var CRON_SECRET "$(openssl rand -hex 24)"
echo "✓ .env created for $SITE"
echo "  Payments, e-mail and invoicing stay off until you fill them in (.env)."
