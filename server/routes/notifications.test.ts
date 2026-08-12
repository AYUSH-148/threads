import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  buildHarness,
  OTHER_VIEWER,
  sampleRow,
  VIEWER,
} from "../test/harness";

describe("GET /api/notifications", () => {
  it("rejects a request with no credential", async () => {
    const { app } = buildHarness();

    const response = await request(app).get("/api/notifications");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("unauthorized");
    // The correlation id is on every error response, which is what makes a
    // user-reported failure findable in the logs.
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("rejects a token it cannot verify", async () => {
    const { app, notifications } = buildHarness();

    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", "Bearer forged");

    expect(response.status).toBe(401);
    // The query was never reached. A 401 that still hits the database is a way to
    // make unauthenticated traffic expensive.
    expect(notifications.calls).toHaveLength(0);
  });

  it("ignores a bearer token in the wrong scheme", async () => {
    const { app } = buildHarness();

    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", "Basic valid-token");

    expect(response.status).toBe(401);
  });

  it("returns the page with the paging it used", async () => {
    const { app, notifications } = buildHarness();
    notifications.page = { notifications: [sampleRow()], isNext: true };

    const response = await request(app)
      .get("/api/notifications?page=2&pageSize=5")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.notifications).toHaveLength(1);
    expect(response.body).toMatchObject({ isNext: true, page: 2, pageSize: 5 });
    expect(notifications.calls[0]).toEqual({
      method: "list",
      userId: VIEWER.userId,
      opts: { page: 2, pageSize: 5 },
    });
  });

  it("defaults the paging when none is given", async () => {
    const { app, notifications } = buildHarness();

    await request(app).get("/api/notifications").set("Authorization", "Bearer valid-token");

    expect(notifications.calls[0].opts).toEqual({ page: 1, pageSize: 20 });
  });

  it.each([
    ["page=0", "page below the first"],
    ["page=-3", "negative page, which would be a negative $skip"],
    ["page=abc", "non-numeric page"],
    ["page=1.5", "fractional page"],
    ["pageSize=0", "empty page"],
    ["pageSize=5000", "page size above the ceiling"],
  ])("rejects ?%s (%s) with a 400", async (query) => {
    const { app, notifications } = buildHarness();

    const response = await request(app)
      .get(`/api/notifications?${query}`)
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_request");
    // Which parameter was wrong is echoed back: unlike a 500, there is nothing
    // internal in a validation failure.
    expect(response.body.error.details).toBeInstanceOf(Array);
    expect(notifications.calls).toHaveLength(0);
  });

  it("never lets a proxy cache one viewer's notifications", async () => {
    const { app } = buildHarness();

    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", "Bearer valid-token");

    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("returns the count for the token's owner", async () => {
    const { app, notifications } = buildHarness({
      tokens: { "token-a": VIEWER, "token-b": OTHER_VIEWER },
    });
    notifications.unread = 7;

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", "Bearer token-b");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 7 });
    expect(notifications.calls[0].userId).toBe(OTHER_VIEWER.userId);
  });
});

describe("POST /api/notifications/read", () => {
  it("reports how many rows it cleared", async () => {
    const { app, notifications } = buildHarness();
    notifications.updated = 4;

    const response = await request(app)
      .post("/api/notifications/read")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: 4 });
  });

  /**
   * The regression test that matters most in this file.
   *
   * A body-supplied user id would let any authenticated account clear anyone
   * else's notifications. The route takes the id from the verified token and
   * there is deliberately no parameter for it, so a body that tries is simply
   * ignored — and this asserts that it stays that way.
   */
  it("ignores a user id in the body and uses the token's identity", async () => {
    const { app, notifications } = buildHarness({
      tokens: { "token-a": VIEWER, "token-b": OTHER_VIEWER },
    });

    const response = await request(app)
      .post("/api/notifications/read")
      .set("Authorization", "Bearer token-a")
      .send({ userId: OTHER_VIEWER.userId, recipient: OTHER_VIEWER.userId });

    expect(response.status).toBe(200);
    expect(notifications.calls).toEqual([
      { method: "markAllRead", userId: VIEWER.userId },
    ]);
  });

  it("does not accept a GET", async () => {
    const { app } = buildHarness();

    const response = await request(app)
      .get("/api/notifications/read")
      .set("Authorization", "Bearer valid-token");

    // A mutation behind a GET is reachable by a prefetch or a link-preview
    // crawler, either of which would silently clear someone's badge.
    expect(response.status).toBe(404);
  });
});

describe("routing", () => {
  it("answers an unknown path with a JSON 404, not an HTML page", async () => {
    const { app } = buildHarness();

    const response = await request(app).get("/api/nope");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  /**
   * body-parser throws a SyntaxError carrying `status: 400`. Without a branch for
   * it, a client's malformed body would be reported as this service's 500 and
   * logged with a stack trace as though it were a bug here.
   */
  it("reports a malformed JSON body as a 400, not a 500", async () => {
    const { app } = buildHarness();

    const response = await request(app)
      .post("/api/notifications/read")
      .set("Authorization", "Bearer valid-token")
      .set("Content-Type", "application/json")
      .send('{"unterminated":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_request");
  });

  it("surfaces an unexpected failure as a 500 with a correlation id", async () => {
    const { app, notifications } = buildHarness();
    notifications.countUnread = async () => {
      throw new Error("mongo exploded");
    };

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("internal_error");
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("hides the internal message from a 500 in production", async () => {
    const { app, notifications } = buildHarness({
      config: { isProduction: true, nodeEnv: "production" },
    });
    notifications.countUnread = async () => {
      throw new Error("mongodb://user:password@cluster/threads timed out");
    };

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe("Something went wrong");
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("echoes an inbound request id so one trace spans both services", async () => {
    const { app } = buildHarness();

    const response = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", "Bearer valid-token")
      .set("X-Request-Id", "trace-from-next");

    expect(response.headers["x-request-id"]).toBe("trace-from-next");
  });
});
