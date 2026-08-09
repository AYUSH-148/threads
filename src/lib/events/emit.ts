import { randomUUID } from "crypto";
import type { ClientSession } from "mongoose";

import Outbox from "../models/outbox.model";
import type { EventOf, EventType } from "./types";

/**
 * Records a domain event in the outbox, inside the caller's transaction.
 *
 * The `session` argument is not optional by accident: an event written outside
 * the transaction that produced it is exactly the failure mode the outbox
 * exists to prevent.
 *
 * Nothing is published here. The relay picks the row up within ~500ms, which
 * keeps Redis off the request path entirely — a Redis outage slows notifications
 * down, it does not fail the user's like.
 */
export async function emit<T extends EventType>(
  session: ClientSession,
  type: T,
  actorId: string,
  payload: EventOf<T>["payload"]
): Promise<string> {
  const eventId = randomUUID();

  await Outbox.create(
    [
      {
        eventId,
        type,
        occurredAt: new Date(),
        actorId,
        payload,
        published: false,
      },
    ],
    // create() only honours a session in its array form — the single-document
    // overload silently ignores the options argument.
    { session }
  );

  return eventId;
}
