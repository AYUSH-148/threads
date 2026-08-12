import { verifyToken } from "@clerk/backend";

import { resolveUserIdByClerkId } from "../../src/lib/identity";
import type { ApiConfig } from "../config";
import type { Logger } from "../logger";
import type { IdentityPort, Viewer } from "../ports";

/**
 * How long a resolved clerkId → userId mapping is trusted.
 *
 * The mapping is immutable in practice: a User document's `_id` never changes,
 * and the Clerk id it is keyed by never changes either. The TTL exists only so
 * that a user created *after* a failed lookup is picked up without a restart.
 */
const IDENTITY_CACHE_TTL_MS = 5 * 60_000;

/** Bounds the cache. Far more than the working set of a single instance. */
const IDENTITY_CACHE_MAX = 10_000;

/**
 * Which `iss` claims are acceptable.
 *
 * Required, and explicitly not `null` — passing null disables the check, which
 * would accept a correctly-signed token from any issuer at all. Matches both
 * shapes Clerk uses: a custom domain (`https://clerk.example.com`) and a
 * development instance (`https://<slug>.clerk.accounts.dev`). This is the same
 * predicate `@clerk/backend` applies to its own verification.
 */
const isClerkIssuer = (iss: string) =>
  iss.startsWith("https://clerk.") || iss.includes(".clerk.accounts");

/**
 * Clerk session token in, application identity out.
 *
 * `@clerk/nextjs`'s `auth()` is not usable here — it reads the request out of
 * `next/headers`, which does not exist outside a Next.js request — so the API
 * verifies the JWT itself against the same Clerk keys the app already uses.
 *
 * Verification is networkless when `CLERK_JWT_KEY` is set: the signature is
 * checked against a local public key, so authenticating a request costs no
 * outbound call and keeps working while Clerk's API is unreachable. Without it
 * the first request fetches the JWKS and caches it, which works but makes a
 * Clerk outage an authentication outage.
 */
export function createClerkIdentity(config: ApiConfig, logger: Logger): IdentityPort {
  const cache = new Map<string, { viewer: Viewer; expiresAt: number }>();

  return {
    async authenticate(token: string): Promise<Viewer | null> {
      let clerkId: string;

      try {
        const claims = await verifyToken(token, {
          secretKey: config.clerkSecretKey,
          jwtKey: config.clerkJwtKey,
          issuer: isClerkIssuer,
          // The origins allowed to have requested this token, checked against the
          // `azp` claim. Without it a token Clerk minted for a different
          // application would verify here perfectly well.
          authorizedParties: config.allowedOrigins,
        });

        // `sub` is the Clerk user id. A token that verifies but carries no
        // subject is not something Clerk issues; treat it as a failure rather
        // than continuing with an empty id.
        if (typeof claims.sub !== "string" || !claims.sub) return null;
        clerkId = claims.sub;
      } catch (err) {
        // Expected constantly — every expired tab produces one. Logged at debug
        // volume rather than as an error, and never rethrown, so the caller sees
        // one uniform 401.
        logger.info("token verification failed", {
          reason: err instanceof Error ? err.message : String(err),
        });
        return null;
      }

      const cached = cache.get(clerkId);
      if (cached && cached.expiresAt > Date.now()) return cached.viewer;

      // The lookup, not the signature check, is what would otherwise put a
      // MongoDB round trip in front of every single request — including the
      // unread-count poll that the badge fires on every stream message.
      const userId = await resolveUserIdByClerkId(clerkId);
      if (!userId) {
        // Authenticated with Clerk but no User document: mid-onboarding, or the
        // webhook that creates the row has not landed yet. Not an error, and
        // deliberately not cached — the row is expected to appear shortly.
        return null;
      }

      const viewer: Viewer = { clerkId, userId };

      // Crude eviction: clear the whole map at the ceiling rather than tracking
      // per-entry recency. At this size the cost is one extra lookup per user
      // after a flush, which is not worth an LRU implementation to avoid.
      if (cache.size >= IDENTITY_CACHE_MAX) cache.clear();
      cache.set(clerkId, { viewer, expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS });

      return viewer;
    },
  };
}
