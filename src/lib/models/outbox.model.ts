import mongoose from "mongoose";

import { EVENT_TYPES } from "../events/types";

/**
 * The transactional outbox.
 *
 * A row is inserted in the same MongoDB transaction as the write that caused it,
 * so the event is durable before anything tries to move it. Publishing straight
 * to Redis after the domain write instead would silently lose the notification
 * whenever the process died in between — and leave no trace that it had.
 *
 * The relay is therefore only transport. If it fails, the row is still here.
 */
const outboxSchema = new mongoose.Schema(
  {
    /** Idempotency key. Generated at emit time, survives every redelivery. */
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: EVENT_TYPES },
    occurredAt: { type: Date, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    /**
     * A boolean rather than `publishedAt: null`, because a partial index needs
     * an equality predicate and `{ publishedAt: null }` also matches documents
     * where the field is merely absent.
     */
    published: { type: Boolean, required: true, default: false },
    publishedAt: { type: Date, default: null },

    /**
     * Set when the row could not be published at all — a payload that fails
     * schema validation, usually a shape the relay was deployed too early to
     * understand. Such a row is marked published so it stops blocking the head
     * of the queue, and this field is the record that it never actually went.
     */
    publishError: { type: String, default: null },
  },
  { timestamps: true }
);

// The relay's only query: oldest unpublished first. The partial filter keeps
// the index proportional to the backlog rather than to the whole collection —
// which, once things are working, is almost always empty.
outboxSchema.index(
  { createdAt: 1 },
  { partialFilterExpression: { published: false } }
);

const Outbox = mongoose.models.Outbox || mongoose.model("Outbox", outboxSchema);

export default Outbox;
