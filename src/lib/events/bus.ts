import type { DomainEvent } from "./types";

/**
 * Transport boundary between the relay and the worker.
 *
 * Redis Streams is the only implementation today. It was chosen over Kafka
 * because the transactional outbox already makes MongoDB the durable record of
 * every event — the broker only has to move events, not own them — and Redis
 * was already in the stack for caching and the SSE fan-out.
 *
 * The interface exists so that changes to that calculus (multi-day replay, a
 * third consumer group with its own retention, CDC via Debezium) cost an
 * adapter rather than a rewrite. It is deliberately thin: everything below maps
 * one-to-one onto both Redis Streams and Kafka consumer-group semantics.
 */
export interface EventBus {
  /** Append events to the log. Returns the transport ids, in input order. */
  publish(events: DomainEvent[]): Promise<string[]>;

  /**
   * Block for up to `blockMs` waiting for events this consumer has not seen.
   * Delivery is at-least-once: entries stay pending until acknowledged.
   */
  read(opts: { count: number; blockMs: number }): Promise<DeliveredEvent[]>;

  /**
   * Reclaim entries delivered to a consumer that never acknowledged them —
   * a worker that crashed mid-batch. This is the retry mechanism.
   */
  claimStale(opts: { minIdleMs: number; count: number }): Promise<DeliveredEvent[]>;

  /** Acknowledge. Only ever called after the downstream write has committed. */
  ack(ids: string[]): Promise<void>;

  /** Park an unparseable entry where a human can find it, then acknowledge it. */
  deadLetter(entry: RawEntry, reason: string): Promise<void>;
}

export interface DeliveredEvent {
  /** Transport id, opaque to handlers; passed back to ack(). */
  id: string;
  event: DomainEvent;
  /** How many times this entry has been delivered. 1 on the first attempt. */
  deliveries: number;
}

export interface RawEntry {
  id: string;
  body: string;
}
