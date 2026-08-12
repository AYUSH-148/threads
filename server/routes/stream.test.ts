import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

import type { Express } from "express";
import { afterEach, describe, expect, it } from "vitest";

import { userChannel } from "../../src/lib/redis";
import { buildHarness, VIEWER, waitFor, type Harness } from "../test/harness";

/**
 * The SSE tests need a real socket.
 *
 * Supertest buffers a response until it ends, and the whole point of this
 * endpoint is that it does not end — so these run against an actual listening
 * server and read the body incrementally, which is also much closer to what a
 * browser's `EventSource` does.
 */
let server: Server | undefined;

async function listen(app: Express): Promise<string> {
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  const running = server;
  server = undefined;
  if (running) await new Promise((resolve) => running.close(resolve));
});

/** Reads one SSE frame's worth of bytes. */
async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value, done } = await reader.read();
  if (done || !value) return "";
  return new TextDecoder().decode(value);
}

async function openStream(harness: Harness, token = "valid-token") {
  const base = await listen(harness.app);
  const response = await fetch(`${base}/api/stream?token=${token}`);
  return { response, reader: response.body!.getReader() };
}

describe("GET /api/stream", () => {
  it("opens a stream and announces itself before any event arrives", async () => {
    const harness = buildHarness();
    const { response, reader } = await openStream(harness);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    // Without these an intermediary buffers the stream and nothing arrives until
    // it decides the response is big enough.
    expect(response.headers.get("cache-control")).toContain("no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");

    // Flushed immediately, which is what moves the browser's EventSource out of
    // CONNECTING so its on-open count refresh can fire.
    expect(await readChunk(reader)).toContain(": connected");

    await reader.cancel();
  });

  it("subscribes to the token owner's channel and nobody else's", async () => {
    const harness = buildHarness();
    const { reader } = await openStream(harness);
    await readChunk(reader);

    expect(harness.subscriber.seen).toEqual([userChannel(VIEWER.userId)]);

    await reader.cancel();
  });

  /**
   * Ordering guarantee, not a nicety.
   *
   * The client re-reads its unread count the moment it sees the connection open.
   * If the greeting went out before the subscription existed, a notification
   * published in that window would be missed by both the stream and the refresh.
   */
  it("is already subscribed by the time it says connected", async () => {
    const harness = buildHarness();
    const { reader } = await openStream(harness);

    expect(await readChunk(reader)).toContain(": connected");
    expect(harness.subscriber.active.has(userChannel(VIEWER.userId))).toBe(true);

    await reader.cancel();
  });

  it("forwards a published message as an SSE data frame", async () => {
    const harness = buildHarness();
    const { reader } = await openStream(harness);
    await readChunk(reader);

    harness.subscriber.emit(
      userChannel(VIEWER.userId),
      JSON.stringify({ type: "notification" })
    );

    expect(await readChunk(reader)).toBe('data: {"type":"notification"}\n\n');

    await reader.cancel();
  });

  /**
   * The leak that would take the service down first.
   *
   * Every stream holds its own Redis connection, because a subscribed connection
   * cannot serve ordinary commands. One that is not released per disconnect means
   * an instance runs out of Redis connections long before anything else.
   */
  it("releases the subscription when the client disconnects", async () => {
    const harness = buildHarness();
    const { reader } = await openStream(harness);
    await readChunk(reader);

    expect(harness.subscriber.active.size).toBe(1);

    await reader.cancel();

    await waitFor(() => harness.subscriber.active.size === 0);
    expect(harness.registry.size).toBe(0);
  });

  it("closes every stream on shutdown so the process can drain", async () => {
    const harness = buildHarness();
    const { reader } = await openStream(harness);
    await readChunk(reader);

    expect(harness.registry.size).toBe(1);

    await harness.registry.closeAll();

    // The client sees the stream end rather than hanging. Reconnecting is its
    // job, and it re-reads the count when it does — which is why dropping every
    // connection on deploy costs latency and not notifications.
    const { done } = await reader.read();
    expect(done).toBe(true);
    expect(harness.subscriber.active.size).toBe(0);
  });

  it("refuses an unauthenticated connection with JSON, not a stream", async () => {
    const harness = buildHarness();
    const base = await listen(harness.app);

    const response = await fetch(`${base}/api/stream`);

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(harness.subscriber.seen).toEqual([]);
  });

  it("refuses a token it cannot verify", async () => {
    const harness = buildHarness();
    const base = await listen(harness.app);

    const response = await fetch(`${base}/api/stream?token=forged`);

    expect(response.status).toBe(401);
    expect(harness.subscriber.seen).toEqual([]);
  });

  /**
   * Subscribing before the headers go out is what makes this possible: once a
   * stream has started there is no status code left to send, so a Redis failure
   * could only be reported by dropping the connection.
   */
  it("reports Redis being unreachable as a 503", async () => {
    const harness = buildHarness();
    harness.subscriber.failNext = true;

    const base = await listen(harness.app);
    const response = await fetch(`${base}/api/stream?token=valid-token`);

    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("unavailable");
  });
});
