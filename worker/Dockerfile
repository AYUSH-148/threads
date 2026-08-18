# Worker image: the relay and consumer loops.
#
# Built from the repo root so the worker can import the Mongoose models and the
# event contract straight out of src/ — one schema definition, not two that
# drift. Build with:
#
#   docker build -f worker/Dockerfile -t relay-worker .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies included: the worker runs TypeScript through tsx rather than
# carrying a separate build step for two long-lived loops.
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# dumb-init makes PID 1 forward SIGTERM, which is what triggers the graceful
# drain in index.ts. Without it the platform's stop signal is ignored and the
# container is killed mid-batch on every deploy.
RUN apk add --no-cache dumb-init

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src/lib ./src/lib
COPY worker ./worker

# Unprivileged: this process needs a network socket and nothing else.
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "tsx", "worker/index.ts"]
