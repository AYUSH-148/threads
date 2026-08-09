import { z } from "zod";

/**
 * The event contract shared by the producer (Server Actions), the relay, and
 * the worker.
 *
 * Events describe facts that already happened — "this thread was liked" — not
 * intentions. Whether a fact deserves a notification is policy, and policy
 * lives in the worker's handlers so it can change without redeploying the app.
 */

/** Mongo ObjectIds cross the wire as 24-char hex strings. */
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "expected an ObjectId");

export const EVENT_TYPES = [
  "thread.liked",
  "thread.commented",
  "community.thread.created",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const payloads = {
  "thread.liked": z.object({
    threadId: objectId,
    /** Denormalised so the handler does not have to re-read the thread. */
    threadAuthorId: objectId,
  }),
  "thread.commented": z.object({
    /** The thread that was replied to. */
    threadId: objectId,
    commentId: objectId,
    threadAuthorId: objectId,
  }),
  "community.thread.created": z.object({
    threadId: objectId,
    communityId: objectId,
  }),
} satisfies Record<EventType, z.ZodTypeAny>;

/**
 * Discriminated on `type`, so a handler receives a payload narrowed to its own
 * event rather than a union it has to re-check.
 */
export const DomainEventSchema = z.discriminatedUnion("type", [
  z.object({
    eventId: z.string().uuid(),
    type: z.literal("thread.liked"),
    occurredAt: z.coerce.date(),
    actorId: objectId,
    payload: payloads["thread.liked"],
  }),
  z.object({
    eventId: z.string().uuid(),
    type: z.literal("thread.commented"),
    occurredAt: z.coerce.date(),
    actorId: objectId,
    payload: payloads["thread.commented"],
  }),
  z.object({
    eventId: z.string().uuid(),
    type: z.literal("community.thread.created"),
    occurredAt: z.coerce.date(),
    actorId: objectId,
    payload: payloads["community.thread.created"],
  }),
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;

/** An event of one specific type, for handler signatures. */
export type EventOf<T extends EventType> = Extract<DomainEvent, { type: T }>;

/**
 * What a handler produces. One event can yield zero drafts (the actor is the
 * recipient) or thousands (a post in a large community) — that asymmetry is
 * the reason this runs in a worker instead of inline in the request.
 */
export interface NotificationDraft {
  recipient: string;
  kind: NotificationKind;
  threadId: string;
  actor: string;
  occurredAt: Date;
}

export const NOTIFICATION_KINDS = ["like", "reply", "community_post"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
