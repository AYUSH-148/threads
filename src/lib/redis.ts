import { createClient } from "redis";

export type Redis = ReturnType<typeof createClient>;

/**
 * Next.js reloads modules on every edit in development, so a plain module-level
 * client leaks a new connection per reload until Redis refuses them. The same
 * globalThis trick the Mongoose singleton uses applies here.
 */
const globalForRedis = globalThis as unknown as { __redis?: Redis };

function url(): string {
  const value = process.env.REDIS_URL;
  if (!value) {
    throw new Error(
      "REDIS_URL is not set. Copy .env.example to .env, or run `docker compose up -d`."
    );
  }
  return value;
}

function build(): Redis {
  const client = createClient({
    url: url(),
    socket: {
      // Upstash and most managed providers drop idle connections; back off
      // rather than reconnecting in a tight loop when the endpoint is down.
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
      keepAlive: 30_000,
    },
  });

  // node-redis emits 'error' on the client; an unhandled one crashes the
  // process, which on Vercel means a 500 on an unrelated request.
  client.on("error", (err) => console.error("[redis] client error:", err));

  return client;
}

/** Shared command connection. Never use this to subscribe — see getSubscriber(). */
export async function getRedis(): Promise<Redis> {
  const existing = globalForRedis.__redis;
  if (existing?.isOpen) return existing;

  const client = build();
  await client.connect();
  globalForRedis.__redis = client;
  return client;
}

/**
 * A dedicated connection for SUBSCRIBE.
 *
 * Once a Redis connection enters subscriber mode it rejects every ordinary
 * command, so sharing getRedis() would break every cache read in the app the
 * moment one SSE client connected. Callers own the returned client and must
 * close it when their stream ends.
 */
export async function getSubscriber(): Promise<Redis> {
  const client = build();
  await client.connect();
  return client;
}

/** Pub/sub channel a user's open SSE connections are listening on. */
export const userChannel = (userId: string) => `user:${userId}`;

/** The event log the worker's consumer group reads from. */
export const STREAM_KEY = "stream:notifications";
export const CONSUMER_GROUP = "notification-writer";

/**
 * Where unparseable and repeatedly-failing entries are parked.
 *
 * Declared here beside the stream it belongs to rather than privately in the bus
 * adapter, because the API service's /metrics endpoint reports its depth — a
 * non-zero DLQ is the signal that events are being dropped, and it is worth
 * exactly one definition of the key.
 */
export const DLQ_KEY = `${STREAM_KEY}:dlq`;
