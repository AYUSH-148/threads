import type { NotificationAggregateRow, NotificationRow } from "./types";

/** Longest thread excerpt carried on a notification row. */
const PREVIEW_LENGTH = 120;

/**
 * Aggregation output to the shape both the page and the API return.
 *
 * Kept pure and separate from the query for one reason: the `$lookup` ordering
 * problem below is the sort of thing that silently produces a plausible-looking
 * wrong answer — "Bob and 2 others" naming the oldest liker instead of the
 * newest — and a pure function is the only version of this that can be tested
 * without a database.
 */
export function mapNotificationRow(row: NotificationAggregateRow): NotificationRow {
  // `$lookup` does not preserve the order of the localField array — it returns
  // documents in whatever order the index walk found them — so recency order has
  // to be restored from previewActorIds, which the pipeline built deliberately.
  const byId = new Map(
    (row.previewActors ?? []).map((actor) => [String(actor._id), actor])
  );

  const actors = (row.previewActorIds ?? [])
    .map((actorId) => byId.get(String(actorId)))
    // An actor's User document can have been deleted since the notification was
    // written. Dropping the dangling reference is better than rendering a blank
    // avatar, and `actorCount` still reflects everyone who acted.
    .flatMap((actor) =>
      actor
        ? [
            {
              id: actor.id ?? "",
              name: actor.name ?? "",
              username: actor.username ?? "",
              image: actor.image ?? "",
            },
          ]
        : []
    );

  return {
    id: String(row._id),
    kind: row.kind,
    threadId: String(row.threadId),
    actors,
    actorCount: row.actorCount ?? 0,
    lastActorAt: new Date(row.lastActorAt).toISOString(),
    // Read state lives in `readAt` rather than a boolean so that the consumer's
    // idempotent write can reset it with a timestamp comparison.
    unread: row.readAt == null,
    threadPreview:
      typeof row.threadPreview === "string"
        ? row.threadPreview.slice(0, PREVIEW_LENGTH)
        : "",
  };
}
