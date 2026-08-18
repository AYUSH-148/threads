# Web image: the Next.js app.
#
#   docker build -t relay-web \
#     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_… \
#     --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 .
#
# Three stages so the runtime image carries neither the source nor the build
# toolchain. The sibling images (server/Dockerfile, worker/Dockerfile) have no
# build step at all — they run TypeScript through tsx — which is why only this one
# is multi-stage.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are substituted into the client bundle at build time, not
# read at boot, so they have to be build arguments. A container started with a
# different NEXT_PUBLIC_API_URL would ignore it — the old value is already
# compiled into the JavaScript the browser downloads.
#
# Deliberately no secrets here. `docker history` shows every ARG, so a
# CLERK_SECRET_KEY passed this way would be readable by anyone with the image.
# The build does not need one: it was verified to complete with CLERK_SECRET_KEY,
# MONGODB_URL and REDIS_URL all unset, because every page that touches them is
# server-rendered on demand rather than prerendered.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


FROM node:20-alpine AS runtime
WORKDIR /app
# HOSTNAME matters: Next binds localhost by default, which inside a container
# means nothing outside it can connect — the published port would accept and hang.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# dumb-init makes PID 1 forward SIGTERM, so the server is asked to stop rather
# than killed mid-request on every deploy.
RUN apk add --no-cache dumb-init

# Neither of these is part of the standalone trace: it bundles the server and its
# modules, and knows nothing about static assets. Copied as `node` so the runtime
# user can read them without a separate chown layer.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# The traced server. Unpacks to ./server.js plus a pruned node_modules.
COPY --from=builder --chown=node:node /app/.next/standalone ./

EXPOSE 3000

# Unprivileged: this process needs a listening socket and its own files.
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
