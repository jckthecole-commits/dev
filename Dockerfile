# syntax=docker/dockerfile:1.7
# Sifra Vision — production image (Next.js standalone output).
#
# The build prerenders the catalogue (Partial Prerendering), so it needs to reach
# PostgreSQL. Build with the database reachable, e.g.:
#   docker build --network=host --build-arg DATABASE_URL=postgres://… \
#                --build-arg NEXT_PUBLIC_SITE_URL=https://sifravision.ro -t sifra-vision .
# or use scripts/docker-up.sh with docker-compose.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY scripts/vendor.mjs scripts/vendor.mjs
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_META_PIXEL_ID=
ARG NEXT_PUBLIC_MEDIA_BASE_URL=
ENV DATABASE_URL=$DATABASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL
RUN pnpm build

# Migrations, seeding and the admin CLI (has tsx + drizzle):
#   docker compose run --rm tools pnpm db:migrate
FROM build AS tools
CMD ["pnpm", "db:migrate"]

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S -G app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
RUN mkdir -p /app/storage /app/.data && chown -R app:app /app/storage /app/.data
USER app
VOLUME ["/app/storage"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "server.js"]
