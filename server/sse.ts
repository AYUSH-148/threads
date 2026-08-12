import type { Response } from "express";

/** Proxies close connections that go quiet; SSE comment lines keep them open. */
export const HEARTBEAT_MS = 15_000;

/**
 * The open SSE connections on this instance.
 *
 * Two things need this. `server.close()` waits for in-flight responses to end,
 * and an SSE response by definition never does — without a registry to close
 * them, every deploy would hang until the platform's kill timeout and take the
 * graceful drain of everything else down with it. And the connection count is
 * the one number that says how much fan-out work this instance is actually
 * doing, which /metrics reports.
 */
export class SseRegistry {
  private readonly connections = new Set<() => Promise<void>>();

  get size(): number {
    return this.connections.size;
  }

  /** Registers a stream's teardown, to be called if the process is shutting down. */
  add(close: () => Promise<void>): void {
    this.connections.add(close);
  }

  /** Forgets a stream that has already closed on its own. */
  remove(close: () => Promise<void>): void {
    this.connections.delete(close);
  }

  /**
   * Ends every open stream.
   *
   * Called on SIGTERM. Clients see the connection drop and reconnect — to
   * another instance if there is one — so the cost of a deploy is a few seconds
   * of latency on the badge rather than a missed notification: the durable copy
   * is already in MongoDB, and the client re-reads its count on connect.
   */
  async closeAll(): Promise<void> {
    const closers = Array.from(this.connections);
    this.connections.clear();
    await Promise.all(closers.map((close) => close().catch(() => {})));
  }
}

/**
 * Puts the response into streaming mode.
 *
 * `flushHeaders()` is the part that matters: without it Node buffers the headers
 * until the first sizeable write, and the browser's `EventSource` stays in
 * CONNECTING — so the client's on-open refresh never fires and the badge looks
 * broken until the first real event.
 */
export function openStream(res: Response): void {
  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disables proxy buffering; without it nginx holds the whole stream.
    "X-Accel-Buffering": "no",
  });

  res.flushHeaders();

  // Node's default socket timeout would eventually kill an idle connection out
  // from under us. The heartbeat below keeps bytes moving, but a stream is
  // explicitly meant to outlive any inactivity window, so the timer goes off.
  res.socket?.setTimeout(0);
  // Heartbeats and change notifications are tiny. Nagle's algorithm would sit on
  // them waiting for more data to batch, adding latency for no benefit.
  res.socket?.setNoDelay(true);
}

/** A comment line. Invisible to `EventSource` handlers; keeps intermediaries awake. */
export function writeComment(res: Response, text: string): void {
  res.write(`: ${text}\n\n`);
}

/** A `message` event. */
export function writeData(res: Response, data: string): void {
  res.write(`data: ${data}\n\n`);
}
