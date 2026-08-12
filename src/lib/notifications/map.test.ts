import { describe, expect, it } from "vitest";

import { mapNotificationRow } from "./map";
import type { NotificationAggregateRow } from "./types";

const ACTOR_A = { _id: "a1", id: "clerk_a", name: "Ada", username: "ada", image: "/a.png" };
const ACTOR_B = { _id: "b2", id: "clerk_b", name: "Bob", username: "bob", image: "/b.png" };
const ACTOR_C = { _id: "c3", id: "clerk_c", name: "Cyd", username: "cyd", image: "/c.png" };

function row(overrides: Partial<NotificationAggregateRow> = {}): NotificationAggregateRow {
  return {
    _id: "n1",
    kind: "like",
    threadId: "t1",
    lastActorAt: new Date("2026-08-12T10:00:00.000Z"),
    readAt: null,
    actorCount: 3,
    previewActorIds: ["c3", "b2", "a1"],
    previewActors: [ACTOR_A, ACTOR_B, ACTOR_C],
    threadPreview: "hello",
    ...overrides,
  };
}

describe("mapNotificationRow", () => {
  /**
   * The bug this function exists to prevent.
   *
   * `$lookup` returns joined documents in whatever order the index walk found
   * them, not in the order of the localField array — so the newest actor is not
   * the one MongoDB happens to hand back first. Getting this wrong renders
   * "Ada and 2 others liked your thread" when it was actually Cyd who just did,
   * which looks entirely plausible and is wrong every time.
   */
  it("restores recency order from previewActorIds, not the lookup's order", () => {
    const mapped = mapNotificationRow(
      row({
        previewActorIds: ["c3", "b2", "a1"],
        // Deliberately the reverse of the requested order.
        previewActors: [ACTOR_A, ACTOR_B, ACTOR_C],
      })
    );

    expect(mapped.actors.map((actor) => actor.username)).toEqual(["cyd", "bob", "ada"]);
  });

  it("drops an actor whose user document has been deleted", () => {
    const mapped = mapNotificationRow(
      row({
        previewActorIds: ["c3", "gone", "a1"],
        previewActors: [ACTOR_A, ACTOR_C],
      })
    );

    expect(mapped.actors.map((actor) => actor.username)).toEqual(["cyd", "ada"]);
    // The count still reflects everyone who acted, so the label stays truthful
    // even when a preview avatar cannot be rendered.
    expect(mapped.actorCount).toBe(3);
  });

  it("survives a row with no actors joined at all", () => {
    const mapped = mapNotificationRow(
      row({ previewActorIds: undefined, previewActors: undefined, actorCount: undefined })
    );

    expect(mapped.actors).toEqual([]);
    expect(mapped.actorCount).toBe(0);
  });

  it("fills missing actor fields rather than emitting undefined", () => {
    const mapped = mapNotificationRow(
      row({ previewActorIds: ["a1"], previewActors: [{ _id: "a1", name: "Ada" }] })
    );

    expect(mapped.actors[0]).toEqual({ id: "", name: "Ada", username: "", image: "" });
  });

  it("is unread exactly when readAt is unset", () => {
    expect(mapNotificationRow(row({ readAt: null })).unread).toBe(true);
    expect(mapNotificationRow(row({ readAt: new Date() })).unread).toBe(false);
  });

  it("emits lastActorAt as an ISO string", () => {
    // Both boundaries this crosses flatten Dates — the server/client component
    // boundary and JSON.stringify on the API response — so it is a string at the
    // source rather than something each consumer has to remember to convert.
    expect(mapNotificationRow(row()).lastActorAt).toBe("2026-08-12T10:00:00.000Z");
  });

  it("normalises a lastActorAt that arrives as a string", () => {
    const mapped = mapNotificationRow(row({ lastActorAt: "2026-08-12T11:30:00.000Z" }));
    expect(mapped.lastActorAt).toBe("2026-08-12T11:30:00.000Z");
  });

  it("truncates the thread preview", () => {
    const mapped = mapNotificationRow(row({ threadPreview: "x".repeat(500) }));
    expect(mapped.threadPreview).toHaveLength(120);
  });

  it("treats a missing preview as empty", () => {
    expect(mapNotificationRow(row({ threadPreview: undefined })).threadPreview).toBe("");
  });

  it("stringifies the ids Mongo returns as ObjectIds", () => {
    const mapped = mapNotificationRow(
      row({ _id: { toString: () => "652f1a" }, threadId: { toString: () => "652f1b" } })
    );

    expect(mapped.id).toBe("652f1a");
    expect(mapped.threadId).toBe("652f1b");
  });
});
