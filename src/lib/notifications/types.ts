import type { NOTIFICATION_KINDS } from "../events/types";

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Ceiling on `pageSize`, so a hand-written query string cannot ask for 10,000 rows.
 *
 * Lives here rather than beside the query because the API's request schema
 * validates against it, and importing it from the service would drag Mongoose
 * and the models into the HTTP layer for the sake of one number.
 */
export const MAX_PAGE_SIZE = 50;

export interface NotificationActor {
  /** Clerk id, for the profile link. */
  id: string;
  name: string;
  username: string;
  image: string;
}

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  threadId: string;
  /** Up to three contributors, most recent first. */
  actors: NotificationActor[];
  /** Everyone, including the actors not in the preview. */
  actorCount: number;
  /**
   * ISO string rather than a Date.
   *
   * This shape crosses two boundaries that both flatten Dates — the
   * server/client component boundary and `JSON.stringify` on the API response —
   * so it is a string at the source instead of something each consumer has to
   * remember to convert.
   */
  lastActorAt: string;
  unread: boolean;
  threadPreview: string;
}

export interface NotificationPage {
  notifications: NotificationRow[];
  isNext: boolean;
}

/** What the aggregation in `service.ts` projects, before mapping. */
export interface NotificationAggregateRow {
  _id: unknown;
  kind: NotificationKind;
  threadId: unknown;
  lastActorAt: Date | string;
  readAt: Date | null;
  actorCount?: number;
  /** The three most recent actor ids, newest first. */
  previewActorIds?: unknown[];
  /** The joined documents for those ids, in whatever order `$lookup` returned. */
  previewActors?: Array<{
    _id: unknown;
    id?: string;
    name?: string;
    username?: string;
    image?: string;
  }>;
  threadPreview?: string;
}
