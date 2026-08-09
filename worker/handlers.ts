import Community from "../src/lib/models/community.model";
import type {
  DomainEvent,
  EventOf,
  EventType,
  NotificationDraft,
} from "../src/lib/events/types";

/**
 * Turns one event into zero or more notifications.
 *
 * The asymmetry here is the reason any of this runs in a worker: `thread.liked`
 * produces a single draft, while `community.thread.created` produces one per
 * member. Doing the second inline would make the poster wait on ten thousand
 * writes.
 *
 * Policy lives here rather than in the producer. An event is a fact about what
 * happened; whether it deserves a notification — and whose — can change without
 * touching the Server Actions or replaying history.
 */
type Handlers = {
  [K in EventType]: (event: EventOf<K>) => Promise<NotificationDraft[]>;
};

const handlers: Handlers = {
  "thread.liked": async (event) => {
    const { threadId, threadAuthorId } = event.payload;

    // Liking your own thread is a fact worth recording and not worth telling
    // you about.
    if (event.actorId === threadAuthorId) return [];

    return [
      {
        recipient: threadAuthorId,
        kind: "like",
        threadId,
        actor: event.actorId,
        occurredAt: event.occurredAt,
      },
    ];
  },

  "thread.commented": async (event) => {
    const { threadId, threadAuthorId } = event.payload;

    if (event.actorId === threadAuthorId) return [];

    return [
      {
        recipient: threadAuthorId,
        kind: "reply",
        threadId,
        actor: event.actorId,
        occurredAt: event.occurredAt,
      },
    ];
  },

  "community.thread.created": async (event) => {
    const { threadId, communityId } = event.payload;

    const community = await Community.findById(communityId)
      .select("members")
      .lean<{ members?: unknown[] } | null>();

    if (!community?.members?.length) return [];

    return community.members
      .map((member) => String(member))
      .filter((member) => member !== event.actorId)
      .map((member) => ({
        recipient: member,
        kind: "community_post" as const,
        threadId,
        actor: event.actorId,
        occurredAt: event.occurredAt,
      }));
  },
};

export async function route(event: DomainEvent): Promise<NotificationDraft[]> {
  // The union has already been narrowed by type at the schema boundary; this
  // cast is the one place the per-type mapping has to be reconciled with the
  // erased dispatch.
  const handler = handlers[event.type] as (e: DomainEvent) => Promise<NotificationDraft[]>;
  if (!handler) {
    throw new Error(`No handler registered for event type "${event.type}"`);
  }
  return handler(event);
}
