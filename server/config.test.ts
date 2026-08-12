import { describe, expect, it } from "vitest";

import { loadConfig } from "./config";

/** The minimum that must be present for the service to start. */
const REQUIRED = {
  MONGODB_URL: "mongodb://localhost:27017/threads?replicaSet=rs0",
  REDIS_URL: "redis://localhost:6379",
  CLERK_SECRET_KEY: "sk_test_123",
};

describe("loadConfig", () => {
  it("applies defaults for everything optional", () => {
    const config = loadConfig({ ...REQUIRED });

    expect(config.port).toBe(4000);
    expect(config.nodeEnv).toBe("development");
    expect(config.isProduction).toBe(false);
    expect(config.allowedOrigins).toEqual(["http://localhost:3000"]);
    expect(config.clerkJwtKey).toBeUndefined();
  });

  it("names every missing variable at once", () => {
    // Restarting a container five times to be told about five missing variables
    // one at a time is a waste of an afternoon.
    expect(() => loadConfig({})).toThrowError(/MONGODB_URL[\s\S]*REDIS_URL[\s\S]*CLERK_SECRET_KEY/);
  });

  /**
   * `.env` files declare optional settings as a bare `KEY=`, which arrives as an
   * empty string rather than undefined — and `.env.example` ships exactly that for
   * `CLERK_JWT_KEY`. Docker Compose produces the same shape when it interpolates
   * an unset variable. Without this, copying the example file and starting the
   * service fails over a variable that is not required.
   */
  it("treats a blank optional variable as absent", () => {
    const config = loadConfig({ ...REQUIRED, CLERK_JWT_KEY: "" });

    expect(config.clerkJwtKey).toBeUndefined();
  });

  it("treats a whitespace-only optional variable as absent", () => {
    expect(loadConfig({ ...REQUIRED, CLERK_JWT_KEY: "   " }).clerkJwtKey).toBeUndefined();
  });

  it("still rejects a blank *required* variable", () => {
    // A blank must not become a silent pass just because blanks are dropped.
    expect(() => loadConfig({ ...REQUIRED, CLERK_SECRET_KEY: "" })).toThrowError(
      /CLERK_SECRET_KEY/
    );
  });

  it("keeps a supplied JWT key", () => {
    const config = loadConfig({ ...REQUIRED, CLERK_JWT_KEY: "-----BEGIN PUBLIC KEY-----" });

    expect(config.clerkJwtKey).toBe("-----BEGIN PUBLIC KEY-----");
  });

  it("splits and trims a comma-separated origin list", () => {
    const config = loadConfig({
      ...REQUIRED,
      APP_ORIGIN: "https://threads.app, https://www.threads.app ,",
    });

    // Both the CORS allow-list and the `azp` claim the Clerk token must carry.
    expect(config.allowedOrigins).toEqual(["https://threads.app", "https://www.threads.app"]);
  });

  it("coerces PORT and rejects one that is not a port", () => {
    expect(loadConfig({ ...REQUIRED, PORT: "8080" }).port).toBe(8080);
    expect(() => loadConfig({ ...REQUIRED, PORT: "not-a-port" })).toThrowError(/PORT/);
    expect(() => loadConfig({ ...REQUIRED, PORT: "99999" })).toThrowError(/PORT/);
  });

  it("marks production, which is what silences internal error messages", () => {
    const config = loadConfig({ ...REQUIRED, NODE_ENV: "production" });

    expect(config.isProduction).toBe(true);
  });

  it("rejects an unrecognised NODE_ENV rather than guessing", () => {
    expect(() => loadConfig({ ...REQUIRED, NODE_ENV: "staging" })).toThrowError(/NODE_ENV/);
  });
});
