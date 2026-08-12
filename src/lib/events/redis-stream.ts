import { CONSUMER_GROUP, DLQ_KEY, STREAM_KEY, type Redis } from "../redis";
import { DomainEventSchema, type DomainEvent } from "./types";
import type { DeliveredEvent, EventBus, RawEntry } from "./bus";

/** Entries are trimmed to roughly this many; '~' lets Redis trim on node boundaries. */
const MAXLEN = 100_000;

/** After this many failed deliveries an entry is poison — park it and move on. */
export const MAX_DELIVERIES = 5;

export class RedisStreamBus implements EventBus {
  constructor(
    private readonly redis: Redis,
    private readonly consumerName: string
  ) {}

  /**
   * Idempotent. Safe to call on every worker boot, including when several
   * replicas start at once.
   *
   * Starts the group at '0' rather than '$': a group created after events were
   * already appended would otherwise skip them permanently. Replaying is
   * harmless because the write in the consumer is idempotent.
   */
  async ensureGroup(): Promise<void> {
    try {
      await this.redis.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, "0", {
        MKSTREAM: true,
      });
    } catch (err) {
      if (!String((err as Error)?.message).includes("BUSYGROUP")) throw err;
    }
  }

  async publish(events: DomainEvent[]): Promise<string[]> {
    const ids: string[] = [];
    for (const event of events) {
      const id = await this.redis.xAdd(
        STREAM_KEY,
        "*",
        { body: JSON.stringify(event) },
        { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: MAXLEN } }
      );
      ids.push(id);
    }
    return ids;
  }

  async read({ count, blockMs }: { count: number; blockMs: number }): Promise<DeliveredEvent[]> {
    const res = await this.redis.xReadGroup(
      CONSUMER_GROUP,
      this.consumerName,
      // '>' means "entries never delivered to any consumer in this group".
      { key: STREAM_KEY, id: ">" },
      { COUNT: count, BLOCK: blockMs }
    );

    if (!res || res.length === 0) return [];
    const messages = (res as Array<{ messages: Array<{ id: string; message: Record<string, string> }> }>)[0]
      .messages;

    return this.decode(messages.map((m) => ({ id: m.id, body: m.message.body ?? "" })), 1);
  }

  /**
   * Entries whose owner never acknowledged them — almost always a worker that
   * died mid-batch.
   *
   * XPENDING first rather than XAUTOCLAIM alone, because the pending entry
   * carries the delivery counter and that is the only way to recognise a
   * poison message before it loops forever.
   */
  async claimStale({ minIdleMs, count }: { minIdleMs: number; count: number }): Promise<DeliveredEvent[]> {
    const pending = (await this.redis.xPendingRange(
      STREAM_KEY,
      CONSUMER_GROUP,
      "-",
      "+",
      count,
      { IDLE: minIdleMs }
    )) as Array<{ id: string; deliveriesCounter: number }> | null;

    if (!pending || pending.length === 0) return [];

    const deliveriesById = new Map(pending.map((p) => [p.id, p.deliveriesCounter]));

    // Anything past the ceiling is never going to succeed. Park it, ack it, and
    // keep the pending list from growing without bound.
    const poison = pending.filter((p) => p.deliveriesCounter > MAX_DELIVERIES).map((p) => p.id);
    for (const id of poison) {
      // Read the entry back before parking it: a dead letter with no payload
      // records that something failed but not what, which is the one thing
      // anyone looking at the DLQ actually needs.
      const [entry] = (await this.redis.xRange(STREAM_KEY, id, id)) as Array<{
        id: string;
        message: Record<string, string>;
      }>;

      await this.deadLetter(
        { id, body: entry?.message?.body ?? "" },
        `exceeded ${MAX_DELIVERIES} delivery attempts`
      );
    }

    const retryable = pending
      .filter((p) => p.deliveriesCounter <= MAX_DELIVERIES)
      .map((p) => p.id);
    if (retryable.length === 0) return [];

    const claimed = (await this.redis.xClaim(
      STREAM_KEY,
      CONSUMER_GROUP,
      this.consumerName,
      minIdleMs,
      retryable
    )) as Array<{ id: string; message: Record<string, string> } | null>;

    const entries: RawEntry[] = [];
    const deliveries: number[] = [];
    for (const item of claimed) {
      // XCLAIM returns null for entries trimmed out of the stream since they
      // were delivered. Nothing to process, but the PEL entry must still go.
      if (!item) continue;
      entries.push({ id: item.id, body: item.message?.body ?? "" });
      deliveries.push(deliveriesById.get(item.id) ?? 1);
    }

    const orphaned = retryable.filter((id) => !entries.some((e) => e.id === id));
    if (orphaned.length > 0) await this.ack(orphaned);

    return this.decodeWith(entries, deliveries);
  }

  async ack(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.redis.xAck(STREAM_KEY, CONSUMER_GROUP, ids);
  }

  /**
   * Parking an entry acknowledges it. An entry that cannot be parsed will never
   * parse on retry, so leaving it pending would redeliver it forever while the
   * stream's real backlog grew behind it.
   */
  async deadLetter(entry: RawEntry, reason: string): Promise<void> {
    await this.redis.xAdd(DLQ_KEY, "*", {
      body: entry.body,
      reason,
      originalId: entry.id,
      failedAt: new Date().toISOString(),
    });
    await this.ack([entry.id]);
  }

  private async decode(entries: RawEntry[], deliveries: number): Promise<DeliveredEvent[]> {
    return this.decodeWith(entries, entries.map(() => deliveries));
  }

  /**
   * Validated on the way in, not trusted because we wrote it: a schema change
   * shipped to the app before the worker means both shapes are in the stream at
   * once, and the old worker must not crash-loop on the new one.
   */
  private async decodeWith(entries: RawEntry[], deliveries: number[]): Promise<DeliveredEvent[]> {
    const out: DeliveredEvent[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        const parsed = DomainEventSchema.safeParse(JSON.parse(entry.body));
        if (!parsed.success) {
          await this.deadLetter(entry, `schema: ${parsed.error.message}`);
          continue;
        }
        out.push({ id: entry.id, event: parsed.data, deliveries: deliveries[i] ?? 1 });
      } catch (err) {
        await this.deadLetter(entry, `json: ${(err as Error).message}`);
      }
    }

    return out;
  }
}
