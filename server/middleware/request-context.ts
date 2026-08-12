import { randomUUID } from "crypto";
import type { RequestHandler } from "express";

import type { Logger } from "../logger";

/** Query parameters whose values must never reach a log line. */
const REDACTED_PARAMS = ["token"];

/**
 * Gives every request an id and an access log line.
 *
 * The id is echoed back in `X-Request-Id` and included in error responses, which
 * is what makes a user-reported failure findable: they quote the id from the
 * response and it appears verbatim in the logs. An inbound id is honoured rather
 * than replaced, so a trace started at the Next app keeps one id end to end.
 */
export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const inbound = req.get("x-request-id");
    req.id = inbound && inbound.length <= 200 ? inbound : randomUUID();
    req.log = logger.child({ requestId: req.id });

    res.setHeader("X-Request-Id", req.id);

    const startedAt = process.hrtime.bigint();

    // 'close' rather than 'finish': it fires for responses that completed *and*
    // for connections the client dropped, which for an SSE stream that ran for
    // twenty minutes is the only one that ever happens.
    res.once("close", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      req.log.info("request", {
        method: req.method,
        path: redactUrl(req.originalUrl),
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        // A stream the client walked away from is normal, not an error, but it is
        // worth being able to tell the two apart when reading a log.
        ...(res.writableEnded ? {} : { aborted: true }),
      });
    });

    next();
  };
}

/**
 * Strips sensitive query values from a URL before it is logged.
 *
 * `EventSource` cannot set request headers, so the SSE endpoint accepts its
 * credential as `?token=`. That is a real tradeoff — a URL is far more likely to
 * be logged than a header — and this is half of what makes it acceptable. The
 * other half is that the token is a Clerk session token with roughly a minute of
 * life, so even a leaked one is close to useless.
 */
export function redactUrl(url: string): string {
  const separator = url.indexOf("?");
  if (separator === -1) return url;

  const path = url.slice(0, separator);

  // Rewritten pair by pair rather than through URLSearchParams: round-tripping
  // through it would re-encode every *other* parameter too, so the logged URL
  // would no longer match what the client actually sent.
  const query = url
    .slice(separator + 1)
    .split("&")
    .map((pair) => {
      const name = pair.split("=", 1)[0];
      return REDACTED_PARAMS.includes(name) ? `${name}=[redacted]` : pair;
    })
    .join("&");

  return `${path}?${query}`;
}
