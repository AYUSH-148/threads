import { randomUUID } from "crypto";

import Outbox from "../src/lib/models/outbox.model";
import { DomainEventSchema, type DomainEvent } from "../src/lib/events/types";
import type { EventBus } from "../src/lib/events/bus";
import type { Redis } from "../src/lib/redis";

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 200;

const LOCK_KEY = "lock:outbox-relay";
const LOCK_TTL_MS = 10_000;

/**
 * Releases the lock only if we still hold it.
 *
 * GET-then-DEL would be a race: the TTL can expire between the two commands,
 * another replica can take the lock, and the DEL would then delete *theirs*.
 * Compare-and-delete has to be one atomic step, which on Redis means a script.
 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

/**
 * Moves committed outbox rows onto the event stream.
 *
 * This is transport and nothing else. It holds no state, and if it dies the
 * rows are still sitting in MongoDB marked unpublished — which is the entire
 * point of writing them there first.
 */
export class OutboxRelay {
  private running = false;

  constructor(
    private readonly bus: EventBus,
    private readonly redis: Redis
  ) {}

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      try {
        const published = await this.drainOnce();
        // Only idle when the backlog is empty; a full batch means there is
        // probably more waiting.
        if (published < BATCH_SIZE) await sleep(POLL_INTERVAL_MS);
      } catch (err) {
        console.error("[relay] cycle failed:", err);
        await sleep(POLL_INTERVAL_MS * 4);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  /**
   * One publish cycle: claim the lock, drain up to BATCH_SIZE rows, release.
   * Returns how many rows were read. Public so the verification script can step
   * the pipeline one cycle at a time instead of racing a background loop.
   */
  async drainOnce(): Promise<number> {
    const token = randomUUID();

    // Several replicas polling the same table would each publish every row.
    // The consumer is idempotent so that is survivable, but it wastes a
    // proportional amount of work — the lock makes one replica the publisher.
    const acquired = await this.redis.set(LOCK_KEY, token, {
      NX: true,
      PX: LOCK_TTL_MS,
    });
    if (!acquired) return 0;

    try {
      const rows = await Outbox.find({ published: false })
        .sort({ createdAt: 1 })
        .limit(BATCH_SIZE)
        .lean<OutboxRow[]>();

      if (rows.length === 0) return 0;

      const publishable: DomainEvent[] = [];
      const publishableIds: unknown[] = [];
      const rejected: { id: unknown; reason: string }[] = [];

      for (const row of rows) {
        const parsed = DomainEventSchema.safeParse({
          eventId: row.eventId,
          type: row.type,
          occurredAt: row.occurredAt,
          actorId: String(row.actorId),
          payload: row.payload,
        });

        if (parsed.success) {
          publishable.push(parsed.data);
          publishableIds.push(row._id);
        } else {
          // A row that fails validation will fail identically forever. Park it
          // so it stops being re-read at the head of the queue on every cycle.
          rejected.push({ id: row._id, reason: parsed.error.message });
        }
      }

      if (publishable.length > 0) {
        await this.bus.publish(publishable);

        // Marked after the append. If this update fails the rows are published
        // again next cycle, which the consumer's idempotent write absorbs —
        // the opposite order would drop events instead.
        await Outbox.updateMany(
          { _id: { $in: publishableIds } },
          { $set: { published: true, publishedAt: new Date() } }
        );
      }

      for (const row of rejected) {
        console.error(`[relay] unpublishable outbox row ${row.id}: ${row.reason}`);
        await Outbox.updateOne(
          { _id: row.id },
          { $set: { published: true, publishedAt: new Date(), publishError: row.reason } }
        );
      }

      return rows.length;
    } finally {
      await this.redis.eval(RELEASE_SCRIPT, {
        keys: [LOCK_KEY],
        arguments: [token],
      });
    }
  }
}

interface OutboxRow {
  _id: unknown;
  eventId: string;
  type: string;
  occurredAt: Date;
  actorId: unknown;
  payload: unknown;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
