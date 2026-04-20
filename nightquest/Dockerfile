FROM node:20-bookworm-slim AS build

WORKDIR /app
ARG API_BASE_URL

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY . .

RUN test -n "$API_BASE_URL"
RUN printf 'VITE_API_BASE_URL=%s\n' "$API_BASE_URL" > apps/web/.env.production
RUN printf 'VITE_API_BASE_URL=%s\n' "$API_BASE_URL" > apps/admin/.env.production
RUN npm run db:generate && npm run build

FROM node:20-bookworm-slim AS api

WORKDIR /app/server
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

RUN mkdir -p /app/server/data

EXPOSE 3001

CMD ["node", "dist/index.js"]

FROM caddy:2-alpine AS caddy

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
COPY --from=build /app/apps/admin/dist /srv/admin
