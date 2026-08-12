import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { silentLogger } from "../logger";
import { errorHandler } from "./error";
import { viewerRateLimit } from "./rate-limit";
import { requestContext } from "./request-context";

/** The documented ceiling of `viewerRateLimit`. */
const LIMIT = 120;

/** The limiter's real neighbours: it sits behind request context and in front of the error handler. */
function appWithLimiter() {
  const app = express();
  app.use(requestContext(silentLogger));
  app.use(viewerRateLimit());
  app.get("/", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler({ isProduction: false }));
  return app;
}

describe("viewerRateLimit", () => {
  it("allows traffic up to the ceiling and refuses the next request", async () => {
    const app = appWithLimiter();
    const agent = request(app);

    // The badge legitimately re-reads its count on every stream message, on
    // reconnect and on tab focus, so the ceiling sits an order of magnitude above
    // what a busy session does.
    for (let i = 0; i < LIMIT; i++) {
      expect((await agent.get("/")).status).toBe(200);
    }

    const refused = await agent.get("/");

    expect(refused.status).toBe(429);
    // Routed through the error handler rather than answered by the limiter, so a
    // 429 carries the same envelope and correlation id as every other failure.
    expect(refused.body.error.code).toBe("rate_limited");
    expect(refused.body.error.requestId).toBeTruthy();
  });

  it("advertises the limit in standard headers", async () => {
    const response = await request(appWithLimiter()).get("/");

    // draft-8 of the IETF RateLimit header spec, so a client can back off before
    // being refused rather than after.
    expect(response.headers["ratelimit-policy"]).toBeDefined();
    // The legacy X-RateLimit-* headers are deliberately off.
    expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});
