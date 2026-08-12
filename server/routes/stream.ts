import { Router } from "express";

import { userChannel } from "../../src/lib/redis";
import { requireAuth, viewerOf } from "../middleware/auth";
import { ApiError } from "../middleware/error";
import type { IdentityPort, SubscriberPort } from "../ports";
import {
  HEARTBEAT_MS,
  openStream,
  SseRegistry,
  writeComment,
  writeData,
} from "../sse";

/**
 * The live notification channel.
 *
 * This was a Next.js route handler on Vercel, and it could not work there. A
 * serverless function has a hard duration cap, so the connection was severed
 * every time regardless of what the code did — the old handler said so in its own
 * comments. Every cut meant a reconnect, a fresh Redis subscriber connection and
 * another unread-count query, forever. A stream that is meant to stay open needs
 * a process that stays open, which is what this service is.
 *
 * SSE rather than WebSockets: the traffic is one-directional, `EventSource`
 * reconnects on its own, and horizontal scaling falls out of Redis pub/sub
 * instead of pinning a user to an instance.
 */
export function streamRouter(deps: {
  identity: IdentityPort;
  subscriber: SubscriberPort;
  registry: SseRegistry;
}): Router {
  const router = Router();

  router.get("/", requireAuth(deps.identity), async (req, res) => {
    const viewer = viewerOf(req);

    // Subscribed before the client is told the stream is open. The client
    // re-reads its unread count the moment it sees the connection, and doing it
    // in this order means the subscription is already live when that read
    // happens — so there is no window where a publish lands between the two and
    // is lost. It also means a Redis failure is still a clean 503 from the error
    // handler, because no headers have gone out yet.
    const unsubscribe = await deps.subscriber
      .subscribe(userChannel(viewer.userId), (message) => {
        // The message carries no payload by design. Sending the count would mean
        // a countDocuments per recipient — ten thousand queries for one post in a
        // large community. "Something changed" costs one query per *connected*
        // viewer instead.
        if (!res.writableEnded) writeData(res, message);
      })
      .catch((err) => {
        req.log.error("subscribe failed", { error: err });
        // 503 rather than 500: the service is fine, Redis is not, and the client
        // should back off and retry rather than treat it as permanent.
        throw ApiError.unavailable("Live updates are temporarily unavailable");
      });

    openStream(res);
    writeComment(res, "connected");

    const heartbeat: ReturnType<typeof setInterval> = setInterval(() => {
      if (!res.writableEnded) writeComment(res, "ping");
    }, HEARTBEAT_MS);

    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;

      clearInterval(heartbeat);
      deps.registry.remove(close);
      // Unsubscribe before the connection is released, or the release races the
      // subscription teardown.
      await unsubscribe().catch((err) =>
        req.log.error("subscriber teardown failed", { error: err })
      );
      if (!res.writableEnded) res.end();
    };

    deps.registry.add(close);

    // Fires when the browser navigates away, the tab closes, or a proxy gives
    // up. Without this every disconnect would leak a Redis connection until the
    // server refused new ones.
    req.on("close", () => void close());
  });

  return router;
}
