import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { ApiError } from "./error";

/**
 * Two limits, because there are two things worth limiting.
 *
 * The coarse one runs before authentication and is keyed by IP: without it,
 * unauthenticated traffic still costs a signature verification per request, so
 * the 401 it earns is not free. The fine one runs after authentication and is
 * keyed by user, so one account cannot use up another's budget just by sharing a
 * NAT with them.
 *
 * Both use the in-process memory store, which is per instance — three replicas
 * means three times the stated limit. That is the honest tradeoff of not running
 * a shared store, and it is fine here because these are abuse ceilings rather
 * than a billing quota. Redis is already in the stack if that changes.
 */

/** Applied to everything, before auth. Generous: normal use must never reach it. */
export function coarseRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // IPv6 addresses are handed out a /64 per device, so limiting by exact
    // address limits nothing — a client can walk its own subnet. The helper
    // truncates to the subnet; for IPv4 it is a passthrough.
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
    // Routed through the error handler rather than answered here, so a 429 has
    // the same envelope and the same correlation id as every other failure. A
    // client that special-cases one error shape should not need a second.
    handler: (_req, _res, next) => next(ApiError.rateLimited()),
  });
}

/**
 * Applied to the notification reads, after auth.
 *
 * Sized against what the UI actually does: the badge re-reads its count on every
 * SSE message, on reconnect, and whenever the tab regains focus. A busy thread
 * plus a user flicking between tabs is a legitimate few dozen requests a minute,
 * so the ceiling sits an order of magnitude above that.
 */
export function viewerRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.viewer?.userId ?? ipKeyGenerator(req.ip ?? "unknown"),
    // Routed through the error handler rather than answered here, so a 429 has
    // the same envelope and the same correlation id as every other failure. A
    // client that special-cases one error shape should not need a second.
    handler: (_req, _res, next) => next(ApiError.rateLimited()),
  });
}
