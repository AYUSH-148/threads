import { hostname } from "os";

import mongoose from "mongoose";

import { RedisStreamBus } from "../src/lib/events/redis-stream";
import { connectToDb } from "../src/lib/mongoose";
import { getRedis } from "../src/lib/redis";
import { NotificationConsumer } from "./consumer";
import { OutboxRelay } from "./relay";

/**
 * The always-on half of the notification pipeline.
 *
 * This exists as a container rather than a route because a consumer group needs
 * a process that stays alive: a serverless function cannot hold XREADGROUP open,
 * and there is nowhere for a 500ms poll loop to live. Scale it by running more
 * replicas — the consumer group splits entries between them, and the relay lock
 * keeps exactly one of them publishing.
 */
async function main() {
  requireEnv("MONGODB_URL");
  requireEnv("REDIS_URL");

  // Distinguishes this replica in the consumer group, so XPENDING attributes
  // unacknowledged entries to the instance that actually took them.
  const consumerName = `${hostname()}-${process.pid}`;

  // The app's connector rather than mongoose.connect directly, so the shared
  // singleton flag stays accurate for anything in the import graph that calls it.
  await connectToDb();
  console.log("[worker] mongo connected");

  const redis = await getRedis();
  console.log("[worker] redis connected");

  const bus = new RedisStreamBus(redis, consumerName);
  await bus.ensureGroup();

  const relay = new OutboxRelay(bus, redis);
  const consumer = new NotificationConsumer(bus, redis);

  console.log(`[worker] started as ${consumerName}`);

  // Both loops run forever in the same process. They are independent: the relay
  // only reads MongoDB and writes Redis, the consumer only the reverse.
  const loops = Promise.all([relay.start(), consumer.start()]);

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, draining`);
    relay.stop();
    consumer.stop();

    // Give the in-flight cycle a chance to finish and acknowledge. Anything it
    // does not get to stays pending and is reclaimed by another replica after
    // CLAIM_IDLE_MS, so a hard kill here costs latency rather than data.
    const drained = await Promise.race([loops, sleep(10_000)]);
    if (drained === undefined) console.warn("[worker] drain timed out");

    await redis.quit().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await loops;
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    console.error(`[worker] ${name} is not set. See .env.example.`);
    process.exit(1);
  }
}

const sleep = (ms: number) => new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms));

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
