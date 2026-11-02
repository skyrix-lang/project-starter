# dependency stage
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY . .
RUN yarn install --immutable

# build stage — static pages embed the site URL, so it's needed here
FROM deps AS build
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN yarn build

# migration stage — applies drizzle/ to DATABASE_URL, then exits
FROM deps AS migrate
CMD ["yarn", "db:migrate"]

# runtime stage — Next.js standalone server (SSR / Server Actions)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone bundles server.js + minimal node_modules; `yarn build` has already
# copied public/ and .next/static into it, so one copy is enough.
COPY --from=build --chown=node:node /app/.next/standalone ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
