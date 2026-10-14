FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter=@relay/api... --filter=@repo/db
RUN pnpm turbo run build --filter=@relay/api

# --- Production stage ---
FROM base AS production
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# db package (migrations + drizzle config) for the start-time migrate step
COPY --from=build /app/packages/db ./packages/db
COPY apps/api/package.json ./apps/api/package.json

# @repo/db with dev deps so drizzle-kit is available for `db:migrate`;
# the api in prod-only mode for the runtime (pino transports etc.)
RUN pnpm install --frozen-lockfile --filter=@repo/db \
 && pnpm install --frozen-lockfile --filter=@relay/api --prod

# Bundled API as .cjs (esbuild's default format) even though package.json says "type": "module"
COPY --from=build /app/apps/api/dist/index.cjs ./apps/api/index.cjs
COPY apps/api/start.sh ./apps/api/start.sh
RUN chmod +x ./apps/api/start.sh

WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["./start.sh"]
