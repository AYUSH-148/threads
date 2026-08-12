import mongoose from "mongoose";

import Outbox from "../../src/lib/models/outbox.model";
import { connectToDb } from "../../src/lib/mongoose";
import { CONSUMER_GROUP, DLQ_KEY, STREAM_KEY, type Redis } from "../../src/lib/redis";
import type { DependencyStatus, HealthPort, PipelineMetrics } from "../ports";

/**
 * Readiness probes and pipeline depth.
 *
 * Everything here reads from the two systems the pipeline already uses, so it
 * adds no infrastructure: the outbox backlog is a count on a collection that
 * exists, and the stream depth is what Redis already tracks for its own consumer
 * groups.
 */
export function createPipelineHealth(redis: Redis): HealthPort {
  return {
    async readiness() {
      // In parallel: a readiness probe that checks two dependencies serially
      // takes as long as both timeouts added together, which is how a probe ends
      // up timing out before it can report anything useful.
      const [mongo, redisStatus] = await Promise.all([probeMongo(), probeRedis(redis)]);
      return { mongo, redis: redisStatus };
    },

    async metrics(): Promise<Omit<PipelineMetrics, "sse">> {
      await connectToDb();

      const [unpublished, oldest, length, pending, deadLettered] = await Promise.all([
        Outbox.countDocuments({ published: false }),
        Outbox.findOne({ published: false })
          .sort({ createdAt: 1 })
          .select("createdAt")
          .lean<{ createdAt: Date } | null>(),
        redis.xLen(STREAM_KEY),
        pendingCount(redis),
        // XLEN on a key that does not exist is 0, so an untouched DLQ needs no
        // special case.
        redis.xLen(DLQ_KEY),
      ]);

      return {
        outbox: {
          unpublished,
          // The number worth alerting on. A high backlog during a burst is
          // normal; the oldest row ageing past a couple of seconds means the
          // relay is wedged or gone, and the events are sitting in MongoDB going
          // nowhere.
          oldestUnpublishedAgeMs: oldest ? Date.now() - oldest.createdAt.getTime() : null,
        },
        stream: { length, pending, deadLettered },
      };
    },
  };
}

async function probeMongo(): Promise<DependencyStatus> {
  const startedAt = Date.now();

  try {
    await connectToDb();

    const db = mongoose.connection.db;
    if (!db) throw new Error("no database handle");

    // A real round trip. `connection.readyState` reports what the driver
    // believes, which stays optimistic for a while after the server has gone.
    await db.admin().ping();

    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeRedis(redis: Redis): Promise<DependencyStatus> {
  const startedAt = Date.now();

  try {
    await redis.ping();
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Delivered-but-unacknowledged entries.
 *
 * Returns 0 rather than failing when the consumer group does not exist: the
 * worker creates it on boot, so an API instance that starts first would otherwise
 * report itself unhealthy for a few seconds over something that is not its
 * concern.
 */
async function pendingCount(redis: Redis): Promise<number> {
  try {
    const summary = await redis.xPending(STREAM_KEY, CONSUMER_GROUP);
    return summary?.pending ?? 0;
  } catch (err) {
    if (String((err as Error)?.message).includes("NOGROUP")) return 0;
    throw err;
  }
}
