import mongoose from "mongoose";
import pLimit from "p-limit";

import Notification from "../src/lib/models/notification.model";
import type { DeliveredEvent, EventBus } from "../src/lib/events/bus";
import type { NotificationDraft } from "../src/lib/events/types";
import { userChannel, type Redis } from "../src/lib/redis";
import { route } from "./handlers";

/** Entries per XREADGROUP call. */
const BATCH_SIZE = 500;

/** How long XREADGROUP parks waiting for work before the loop comes back around. */
const BLOCK_MS = 5_000;

/**
 * Concurrent handler invocations.
 *
 * Not Promise.all over the batch: handlers hit MongoDB (the community member
 * lookup), and 500 simultaneous queries exhaust the connection pool, at which
 * point every request in the app queues behind them. 20 keeps the pipe full
 * without becoming the reason the database is slow.
 */
const HANDLER_CONCURRENCY = 20;

/** An entry unacknowledged for this long is assumed to belong to a dead worker. */
const CLAIM_IDLE_MS = 30_000;

export class NotificationConsumer {
  private running = false;

  constructor(
    private readonly bus: EventBus,
    private readonly redis: Redis
  ) {}

  async start(): Promise<void> {
    this.running = true;

    while (this.running) {
      try {
        // Stale entries first, so a crashed worker's batch is not stuck behind
        // however much traffic has arrived since.
        const reclaimed = await this.bus.claimStale({
          minIdleMs: CLAIM_IDLE_MS,
          count: BATCH_SIZE,
        });
        if (reclaimed.length > 0) {
          console.warn(`[consumer] reclaimed ${reclaimed.length} stale entries`);
          await this.processBatch(reclaimed);
        }

        await this.runOnce();
      } catch (err) {
        console.error("[consumer] cycle failed:", err);
        await sleep(2_000);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  /**
   * One read-process-ack cycle. Returns how many entries were handled. Public so
   * the verification script can step the pipeline deterministically rather than
   * racing a background loop.
   */
  async runOnce(opts: { count?: number; blockMs?: number } = {}): Promise<number> {
    const batch = await this.bus.read({
      count: opts.count ?? BATCH_SIZE,
      blockMs: opts.blockMs ?? BLOCK_MS,
    });
    if (batch.length > 0) await this.processBatch(batch);
    return batch.length;
  }

  private async processBatch(batch: DeliveredEvent[]): Promise<void> {
    const limit = pLimit(HANDLER_CONCURRENCY);

    const settled = await Promise.allSettled(
      batch.map((delivered) =>
        limit(async () => ({
          id: delivered.id,
          drafts: await route(delivered.event),
        }))
      )
    );

    const succeededIds: string[] = [];
    const drafts: NotificationDraft[] = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        succeededIds.push(result.value.id);
        drafts.push(...result.value.drafts);
      } else {
        // Left unacknowledged on purpose: it stays in the pending list and
        // claimStale() picks it up in 30s. After MAX_DELIVERIES the bus parks it.
        console.error(
          `[consumer] handler failed for ${batch[i].id} ` +
            `(delivery ${batch[i].deliveries}):`,
          result.reason
        );
      }
    }

    if (drafts.length > 0) {
      // ordered: false so one duplicate-key error does not abandon the rest of
      // the batch. Any throw here skips the ack below, and the whole batch is
      // redelivered — which is safe precisely because these writes are idempotent.
      await Notification.bulkWrite(drafts.map(collapseOp), { ordered: false });
    }

    // Only now. Acknowledging before the write means a crash in between loses
    // the notification with no record that it existed.
    await this.bus.ack(succeededIds);

    await this.notify(drafts);
  }

  /**
   * One publish per distinct recipient, not per draft.
   *
   * The message carries no payload. Sending the unread count would mean a
   * countDocuments per recipient — ten thousand queries for one community post.
   * Instead the client is told something changed and asks for the count itself,
   * which costs one query per *connected* user rather than per recipient.
   *
   * Failures here are logged and swallowed: the durable copy is already in
   * MongoDB, so a dropped message costs a late badge, not a lost notification.
   */
  private async notify(drafts: NotificationDraft[]): Promise<void> {
    const recipients = new Set(drafts.map((draft) => draft.recipient));
    const message = JSON.stringify({ type: "notification" });

    await Promise.all(
      Array.from(recipients).map((recipient) =>
        this.redis
          .publish(userChannel(recipient), message)
          .catch((err) => console.error(`[consumer] publish to ${recipient} failed:`, err))
      )
    );
  }
}

/**
 * Collapses a draft into the one row for its (recipient, kind, thread).
 *
 * Written as an aggregation-pipeline update because every field has to be
 * computed from the row's current value to stay idempotent under redelivery:
 *
 *   actors      $filter-then-append rather than $addToSet, so the array keeps
 *               recency order (newest last) while re-adding an existing actor
 *               is still a no-op.
 *   lastActorAt $max, so an event that arrives late cannot drag the sort key
 *               backwards.
 *   readAt      reset to null only when the actor is genuinely new. A redelivery
 *               of an actor already in the array must not resurface a
 *               notification the recipient has already read.
 *
 * A `count` field maintained with $inc would be the obvious alternative and is
 * wrong: at-least-once delivery guarantees it eventually double-counts. The
 * count is `actors.length`.
 */
function collapseOp(draft: NotificationDraft) {
  const actor = new mongoose.Types.ObjectId(draft.actor);
  const existing = { $ifNull: ["$actors", []] };

  return {
    updateOne: {
      filter: {
        recipient: new mongoose.Types.ObjectId(draft.recipient),
        kind: draft.kind,
        threadId: new mongoose.Types.ObjectId(draft.threadId),
      },
      update: [
        {
          $set: {
            actors: {
              $concatArrays: [
                { $filter: { input: existing, cond: { $ne: ["$$this", actor] } } },
                [actor],
              ],
            },
            lastActorAt: {
              $max: [{ $ifNull: ["$lastActorAt", new Date(0)] }, draft.occurredAt],
            },
            readAt: {
              $cond: [
                { $in: [actor, existing] },
                { $ifNull: ["$readAt", null] },
                null,
              ],
            },
            createdAt: { $ifNull: ["$createdAt", draft.occurredAt] },
          },
        },
      ],
      upsert: true,
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
