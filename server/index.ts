import mongoose from "mongoose";

import { connectToDb } from "../src/lib/mongoose";
import { getRedis } from "../src/lib/redis";
import { createClerkIdentity } from "./adapters/clerk-identity";
import { createMongoNotifications } from "./adapters/mongo-notifications";
import { createPipelineHealth } from "./adapters/pipeline-health";
import { createRedisSubscriber } from "./adapters/redis-subscriber";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { SseRegistry } from "./sse";

/** How long a shutdown is allowed to take before the process stops being polite. */
const DRAIN_TIMEOUT_MS = 10_000;

/**
 * The HTTP half of the always-on tier.
 *
 * This process and the worker are deliberately separate deployables even though
 * both are long-running Node processes on the same two backing services, because
 * they scale on different axes: this one's load is the number of *connected*
 * viewers, the worker's is the number of events. Merging them would mean adding
 * consumers to absorb a traffic spike, or adding SSE capacity to absorb a
 * notification spike.
 */
async function main() {
  const config = loadConfig();
  const logger = createLogger({ json: config.isProduction });

  // Both eagerly, before the port opens. A service that connects lazily on first
  // request reports itself healthy and then fails the first thing a user does.
  await connectToDb();
  const redis = await getRedis();
  logger.info("dependencies connected");

  const registry = new SseRegistry();

  const app = createApp({
    config,
    logger,
    identity: createClerkIdentity(config, logger),
    notifications: createMongoNotifications(),
    subscriber: createRedisSubscriber(),
    health: createPipelineHealth(redis),
    registry,
  });

  const server = app.listen(config.port, () => {
    logger.info("listening", {
      port: config.port,
      env: config.nodeEnv,
      origins: config.allowedOrigins.join(","),
    });
  });

  const shutdown = async (signal: string) => {
    logger.info("shutting down", { signal, openStreams: registry.size });

    // Order matters. Stop taking new connections first, so nothing arrives that
    // is about to be cut off.
    server.close();

    // Then end the streams. `server.close()` waits for in-flight responses to
    // finish and an SSE response never finishes on its own, so without this the
    // process would hang until the platform killed it — losing the graceful part
    // of the shutdown entirely.
    await registry.closeAll();

    await Promise.race([
      Promise.all([
        redis.quit().catch(() => {}),
        mongoose.disconnect().catch(() => {}),
      ]),
      sleep(DRAIN_TIMEOUT_MS),
    ]);

    logger.info("shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // A rejection nobody handled has already left some request in an unknown
  // state. Logging it and staying up beats exiting — but it is a bug, and it
  // should be loud in the logs rather than silent.
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", {
      error: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
    });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
