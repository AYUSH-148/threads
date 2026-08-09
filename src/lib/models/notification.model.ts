import mongoose from "mongoose";

import { NOTIFICATION_KINDS } from "../events/types";

/**
 * Materialised notifications — what the activity page reads.
 *
 * This replaces deriving the feed on every page view. The previous version
 * loaded every thread the user had authored and flattened every embedded like
 * in memory, so the cost of one page view grew with the account's whole
 * history. Here the row is written once, when the like happens.
 *
 * One row per (recipient, kind, thread) rather than per event: fifty likes on
 * one thread is one "Alice and 49 others" row, not fifty rows.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, required: true, enum: NOTIFICATION_KINDS },
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: "Thread", required: true },

    /**
     * Everyone who contributed to this notification, newest last.
     *
     * Written with $addToSet, which is what makes the consumer idempotent:
     * redelivering the same event re-adds an actor already in the array and
     * changes nothing. A counter incremented with $inc would double-count, and
     * at-least-once delivery guarantees that eventually happens.
     */
    actors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    /** Sort key for the feed. Written with $max, so redelivery cannot move it backwards. */
    lastActorAt: { type: Date, required: true },

    readAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false }
);

// The collapse key. Unique because the consumer upserts on exactly this triple,
// and two workers processing the same thread concurrently must converge on one
// row rather than race into two.
notificationSchema.index({ recipient: 1, kind: 1, threadId: 1 }, { unique: true });

// The activity feed: one recipient's rows, newest first, paginated.
notificationSchema.index({ recipient: 1, lastActorAt: -1 });

// The unread badge. Sparse on readAt: null would be smaller, but a partial
// index cannot be used by a sort, and the badge counts rather than sorts.
notificationSchema.index({ recipient: 1, readAt: 1 });

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
