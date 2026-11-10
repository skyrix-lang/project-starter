# One image per customer app. The same image runs anywhere: everything it needs
# to know (PUBLIC_URL, DATABASE_URL, OIDC_*) is read from the environment when
# the container starts, never baked in at build time.

# dependency stage: lockfile only, no install scripts (.yarnrc.yml)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY . .
RUN yarn install --immutable

# build stage: the SPA (apps/web/dist) and the BFF bundled into one file
FROM deps AS build
RUN yarn build

# migration stage: applies packages/db/drizzle to DATABASE_URL, then exits.
# Run it as a deploy step before the new version starts.
FROM deps AS migrate
CMD ["yarn", "db:migrate"]

# runtime stage: Node, one JavaScript file and static assets. No node_modules,
# no package manager, no source, and an unprivileged user.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/public
COPY --from=build --chown=node:node /app/apps/bff/dist/ ./
COPY --from=build --chown=node:node /app/apps/web/dist/ ./public/
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "server.js"]
