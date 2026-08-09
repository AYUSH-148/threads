import { getCurrentUserId } from "@/lib/auth";
import { getSubscriber, userChannel } from "@/lib/redis";

/**
 * Server-Sent Events channel for live notification updates.
 *
 * SSE rather than WebSockets: the traffic is one-directional, the browser
 * reconnects on its own, and horizontal scaling is handled by Redis pub/sub
 * rather than by pinning a user to a server. WebSockets would need a sticky
 * persistent connection, which is the one thing this deployment cannot offer.
 *
 * The messages carry no data. They say "something changed", and the client asks
 * for the count — so the worker does not have to run a countDocuments per
 * recipient when one community post touches ten thousand of them.
 */

// Not the Edge runtime: this holds a Redis socket open, which Edge cannot do.
export const runtime = "nodejs";

// The response must never be cached or buffered, by Next or by anything in front of it.
export const dynamic = "force-dynamic";

/** Proxies close connections that go quiet; SSE comment lines keep them open. */
const HEARTBEAT_MS = 15_000;

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();

  // A dedicated connection. A subscribed Redis client rejects every ordinary
  // command, so sharing the app's shared client would break each cache read the
  // moment one browser opened this route.
  const subscriber = await getSubscriber();

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const close = async () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    // unsubscribe before quit, or the quit races the subscription teardown.
    await subscriber.unsubscribe(userChannel(userId)).catch(() => {});
    await subscriber.quit().catch(() => {});
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between the check and the enqueue.
          void close();
        }
      };

      // Tells EventSource the connection is live, and flushes any proxy that
      // buffers until it sees bytes.
      send(": connected\n\n");

      await subscriber.subscribe(userChannel(userId), (message) => {
        send(`data: ${message}\n\n`);
      });

      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      // Serverless platforms cap function duration, so this connection will be
      // cut whatever we do. EventSource reconnects on its own, and the client
      // re-reads the count on connect — which is why no state is accumulated here.
      request.signal.addEventListener("abort", () => {
        void close();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },

    async cancel() {
      await close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables proxy buffering; without it nginx holds the whole stream.
      "X-Accel-Buffering": "no",
    },
  });
}
