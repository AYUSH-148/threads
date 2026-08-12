import mongoose from "mongoose";

/**
 * Next.js reloads modules on every edit in development, so a plain module-level
 * variable would hand out a new connection per reload. Same globalThis trick as
 * the Redis singleton.
 */
const globalForMongo = globalThis as unknown as { __mongoConnection?: Promise<void> };

/**
 * Connects once per process and hands every later caller the same connection.
 *
 * The in-flight promise is cached rather than a boolean set after the await. A
 * flag leaves a window where N concurrent first requests all see `false` and all
 * call `mongoose.connect()` — which the API service hits on every cold start,
 * since the first burst of requests arrives before any of them has finished
 * connecting.
 *
 * Failures reject and clear the cache, so the next request retries instead of
 * being handed a permanently poisoned promise. Earlier this logged the error and
 * returned normally, which meant the caller went on to query a database it was
 * not connected to and failed somewhere less obvious.
 */
export const connectToDb = async (): Promise<void> => {
  mongoose.set("strictQuery", true);

  const existing = globalForMongo.__mongoConnection;
  if (existing) return existing;

  const url = process.env.MONGODB_URL;
  if (!url) {
    throw new Error(
      "MONGODB_URL is not set. Copy .env.example to .env — and note that it must " +
        "point at a replica set, since the outbox write is transactional."
    );
  }

  const connecting = mongoose
    .connect(url)
    .then(() => {
      console.log("[mongo] connected");
    })
    .catch((error) => {
      globalForMongo.__mongoConnection = undefined;
      throw error;
    });

  globalForMongo.__mongoConnection = connecting;
  return connecting;
};
