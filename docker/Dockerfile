# One image per customer app. The same image runs anywhere: everything it needs
# to know (PUBLIC_URL, DATABASE_URL, OIDC_*) is read from the environment when
# the container starts, never baked in at build time.

# One base for every stage, pinned by digest so a build is repeatable: the tag
# alone can point at a different image tomorrow. Dependabot updates the digest.
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS base
WORKDIR /app

# Only what `yarn install` reads: the lockfile, Yarn's settings and every
# workspace's package.json, found rather than listed so a new package needs no
# change here. The stage is rebuilt on every source change, but its output is
# the same unless a dependency changed, so the install below stays cached.
FROM base AS manifests
COPY . /src
RUN cd /src && mkdir /out && cp yarn.lock .yarnrc.yml /out/ \
    && find . -name package.json -not -path "*/node_modules/*" \
       -exec sh -c 'mkdir -p "/out/$(dirname "$1")" && cp "$1" "/out/$1"' _ {} \;

# dependency stage: lockfile only, no install scripts (.yarnrc.yml)
FROM base AS deps
RUN corepack enable
COPY --from=manifests /out/ ./
RUN --mount=type=cache,target=/root/.yarn/berry/cache yarn install --immutable
COPY . .

# build stage: the SPA (apps/web/dist) and the BFF bundled into one file
FROM deps AS build
RUN yarn build

# migration stage: applies packages/db/drizzle to DATABASE_URL, then exits.
# Run it as a deploy step before the new version starts.
FROM deps AS migrate
CMD ["yarn", "db:migrate"]

# runtime stage: Node, one JavaScript file and static assets. No node_modules,
# no package manager, no source, and an unprivileged user.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/public
COPY --from=build --chown=node:node /app/apps/bff/dist/ ./
COPY --from=build --chown=node:node /app/apps/web/dist/ ./public/
USER node
EXPOSE 3000
# 503 when the database is unreachable (apps/bff/src/health.ts). Node does the
# request, so this needs no shell or wget and survives a move to a smaller base.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--enable-source-maps", "server.js"]
