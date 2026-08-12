import { Router } from "express";
import { z } from "zod";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../../src/lib/notifications/types";
import { requireAuth, viewerOf } from "../middleware/auth";
import { viewerRateLimit } from "../middleware/rate-limit";
import type { IdentityPort, NotificationsPort } from "../ports";

/**
 * Query parameters are strings until proven otherwise.
 *
 * `z.coerce` rather than `parseInt`, because `parseInt("3abc")` is 3 — it fails
 * open on exactly the input a fuzzer sends first. A value that is not cleanly a
 * number is a 400 here, before it can reach a `$skip` stage.
 */
const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/**
 * The notification read/write surface the browser talks to.
 *
 * These were Server Actions. They moved because the callers are client
 * components — the badge polls a count on every stream message, the activity
 * page marks rows read — and a Server Action reachable from the browser is an
 * unversioned RPC endpoint with no request validation, no rate limit and no
 * status codes. Making it an HTTP API is not ceremony; it is what lets the three
 * middlewares above the handlers exist at all.
 *
 * The first render of /activity does not come through here. A Server Component
 * calling its own service over HTTP would pay a network hop and invent a new way
 * for the page to fail, so it calls the same query module directly — the API and
 * the page share the query, not the transport.
 */
export function notificationsRouter(deps: {
  identity: IdentityPort;
  notifications: NotificationsPort;
}): Router {
  const router = Router();

  router.use(requireAuth(deps.identity), viewerRateLimit());

  // Every response here is one viewer's private data. `no-store` rather than
  // `private`, so that a shared proxy cannot hold a copy at all.
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  /** One page of the viewer's notifications, newest first. */
  router.get("/", async (req, res) => {
    const { page, pageSize } = PageQuery.parse(req.query);
    const viewer = viewerOf(req);

    const result = await deps.notifications.list(viewer.userId, { page, pageSize });

    // Paging echoed back so the client does not have to remember what it asked
    // for to render the pager.
    res.json({ ...result, page, pageSize });
  });

  /** The badge. Deliberately the cheapest endpoint in the service. */
  router.get("/unread-count", async (req, res) => {
    const viewer = viewerOf(req);
    res.json({ count: await deps.notifications.countUnread(viewer.userId) });
  });

  /**
   * Clears the badge.
   *
   * POST rather than GET because it mutates — which also means a link preview
   * crawler or a prefetch cannot silently mark someone's activity read.
   *
   * It takes no body. The rows updated are the caller's, identified by the
   * verified token; there is deliberately no `userId` parameter to forge.
   */
  router.post("/read", async (req, res) => {
    const viewer = viewerOf(req);
    res.json({ updated: await deps.notifications.markAllRead(viewer.userId) });
  });

  return router;
}
