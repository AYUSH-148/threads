import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildHarness, fakeHealth } from "../test/harness";

describe("GET /healthz", () => {
  /**
   * A liveness probe that checked MongoDB would make the platform restart every
   * replica during a database blip — removing the only processes still able to
   * serve anything and turning a degraded system into an outage.
   */
  it("reports the process is alive without touching a dependency", async () => {
    const health = fakeHealth({
      mongo: { ok: false, latencyMs: 5_000, error: "connection refused" },
      redis: { ok: false, latencyMs: 5_000, error: "connection refused" },
    });

    const response = await request(buildHarness({ health }).app).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("needs no credential", async () => {
    const response = await request(buildHarness().app).get("/healthz");
    expect(response.status).toBe(200);
  });
});

describe("GET /readyz", () => {
  it("is ready when both dependencies answer", async () => {
    const response = await request(buildHarness().app).get("/readyz");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.mongo.ok).toBe(true);
    expect(response.body.redis.ok).toBe(true);
  });

  /**
   * 503 takes the instance out of the load balancer without killing it, so it
   * rejoins on its own when Redis comes back.
   */
  it("is degraded when Redis is down", async () => {
    const health = fakeHealth({
      mongo: { ok: true, latencyMs: 2 },
      redis: { ok: false, latencyMs: 30, error: "ECONNREFUSED" },
    });

    const response = await request(buildHarness({ health }).app).get("/readyz");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.redis.error).toBe("ECONNREFUSED");
  });
});

describe("GET /metrics", () => {
  it("reports pipeline depth, relay lag and open streams", async () => {
    const response = await request(buildHarness().app).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      outbox: { unpublished: 3, oldestUnpublishedAgeMs: 412 },
      stream: { length: 128, pending: 2, deadLettered: 0 },
      // Counted by this instance rather than the probe: it is the one number that
      // is per-process rather than per-cluster.
      sse: { connections: 0 },
    });
  });
});
