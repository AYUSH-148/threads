# API service image: SSE, the notification endpoints, health and metrics.
#
# Built from the repo root so the service can import the Mongoose models, the
# notification queries and the Redis key names straight out of src/ — one
# definition shared with the app and the worker, not three that drift. Build with:
#
#   docker build -f server/Dockerfile -t relay-api .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies included: the service runs TypeScript through tsx rather than
# carrying a separate build step, the same way the worker does.
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# dumb-init makes PID 1 forward SIGTERM, which is what triggers the graceful
# shutdown in index.ts. That matters more here than in most services: SSE
# responses never end on their own, so without the signal the platform kills the
# container with connections still open instead of closing them first.
RUN apk add --no-cache dumb-init

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/lib ./src/lib
COPY server ./server

EXPOSE 4000

# Unprivileged: this process needs a listening socket and nothing else.
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "server/index.ts"]
