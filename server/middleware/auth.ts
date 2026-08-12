import type { Request, RequestHandler } from "express";

import type { IdentityPort, Viewer } from "../ports";
import { ApiError } from "./error";

/**
 * The authenticated viewer, or a 401.
 *
 * A handler mounted behind `requireAuth` always has one, so this never actually
 * throws — it exists so handlers do not assert with `req.viewer!`, which would
 * turn "someone reordered the middleware" from an exception into a crash on
 * `undefined.userId` several lines later.
 */
export function viewerOf(req: Request): Viewer {
  if (!req.viewer) throw ApiError.unauthorized();
  return req.viewer;
}

/**
 * Rejects anything without a valid Clerk session token.
 *
 * Identity is derived from the token's signature and nothing else. No handler
 * behind this reads a user id from a body, a param or a query string — the whole
 * point of the middleware is that `req.viewer` is the only identity in scope, so
 * there is nothing for a caller to substitute.
 */
export function requireAuth(identity: IdentityPort): RequestHandler {
  return async (req, _res, next) => {
    const token = extractToken(req.get("authorization"), req.query.token);

    if (!token) {
      next(ApiError.unauthorized("Missing bearer token"));
      return;
    }

    const viewer = await identity.authenticate(token);
    if (!viewer) {
      // One message for every failure mode. Distinguishing "expired" from "bad
      // signature" from "no such user" would tell an attacker which of their
      // guesses was closest.
      next(ApiError.unauthorized("Invalid or expired token"));
      return;
    }

    req.viewer = viewer;
    next();
  };
}

/**
 * Bearer header first, `?token=` second.
 *
 * The query parameter exists for exactly one caller: `EventSource` cannot set
 * request headers, and there is no version of the SSE endpoint that authenticates
 * over a header without abandoning the browser's built-in streaming client. It is
 * accepted everywhere rather than only on that route because a credential is
 * either valid or not — and the two things that make it tolerable apply
 * regardless: the value is redacted from this service's access log, and a Clerk
 * session token expires about a minute after it is issued.
 */
export function extractToken(
  authorization: string | undefined,
  queryToken: unknown
): string | null {
  if (authorization) {
    const [scheme, value] = authorization.split(" ");
    // Case-insensitive: the scheme is a token per RFC 7235, and fetch wrappers
    // are not consistent about how they capitalise it.
    if (scheme?.toLowerCase() === "bearer" && value) return value.trim() || null;
    return null;
  }

  // Express parses repeated parameters into an array. A request with two tokens
  // is not something a legitimate client sends, so it is refused rather than
  // resolved by picking one.
  if (typeof queryToken === "string" && queryToken.length > 0) return queryToken;

  return null;
}
