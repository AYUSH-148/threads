import type { NotificationPage } from "../src/lib/notifications/types";

/**
 * What the HTTP layer needs, expressed as interfaces rather than imports.
 *
 * Same reasoning as `EventBus` in src/lib/events/bus.ts: routes that import
 * Mongoose and Redis directly can only be tested against Mongoose and Redis, so
 * the test suite either needs live infrastructure or the routes go untested. The
 * adapters in server/adapters/ are the real implementations; the tests pass
 * fakes; neither the routes nor the tests change when one is swapped.
 */

/** Resolved identity of the caller. Never taken from the request body or params. */
export interface Viewer {
  clerkId: string;
  /** The Mongo `_id` that documents reference. */
  userId: string;
}

export interface IdentityPort {
  /**
   * Verify a Clerk session token and resolve it to app identity.
   *
   * Returns null for anything that fails — expired, wrong signature, no matching
   * User document. The caller turns that into one 401 without distinguishing
   * between the cases, because telling an attacker *which* check failed is free
   * information they should not get.
   */
  authenticate(token: string): Promise<Viewer | null>;
}

export interface NotificationsPort {
  list(userId: string, opts: { page: number; pageSize: number }): Promise<NotificationPage>;
  countUnread(userId: string): Promise<number>;
  /** Returns how many rows changed. */
  markAllRead(userId: string): Promise<number>;
}

/** Closes a subscription and releases its connection. */
export type Unsubscribe = () => Promise<void>;

export interface SubscriberPort {
  /**
   * Listen on one user's pub/sub channel.
   *
   * Each call must own its own connection: a Redis connection in subscriber mode
   * rejects every ordinary command, so a shared one would break the rest of the
   * service the moment a browser opened the stream.
   */
  subscribe(channel: string, onMessage: (message: string) => void): Promise<Unsubscribe>;
}

export interface DependencyStatus {
  ok: boolean;
  /** Round-trip time of the probe, milliseconds. */
  latencyMs: number;
  error?: string;
}

export interface ReadinessReport {
  mongo: DependencyStatus;
  redis: DependencyStatus;
}

/**
 * Depth and lag of the notification pipeline.
 *
 * The pipeline had no observability at all before this: whether the relay was
 * keeping up, whether entries were piling up unacknowledged, and whether
 * anything had been dead-lettered were all questions you could only answer by
 * opening a Redis shell.
 */
export interface PipelineMetrics {
  outbox: {
    /** Rows the relay has not published yet. Steady state is ~0. */
    unpublished: number;
    /**
     * Age of the oldest unpublished row.
     *
     * The number that actually matters: `unpublished` being high during a burst
     * is normal, whereas the oldest row ageing past a few seconds means the
     * relay is stuck or dead.
     */
    oldestUnpublishedAgeMs: number | null;
  };
  stream: {
    length: number;
    /** Delivered but unacknowledged — in-flight work, or a crashed consumer's. */
    pending: number;
    /** Non-zero means events were discarded. Should alert. */
    deadLettered: number;
  };
  sse: {
    /** Open SSE connections on this instance. */
    connections: number;
  };
}

export interface HealthPort {
  readiness(): Promise<ReadinessReport>;
  metrics(): Promise<Omit<PipelineMetrics, "sse">>;
}
