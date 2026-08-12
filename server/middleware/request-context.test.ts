import { describe, expect, it } from "vitest";

import { redactUrl } from "./request-context";

/**
 * Half of what makes accepting a credential in a query string acceptable.
 *
 * A URL reaches far more logs than a header does, so if the SSE token were
 * written out verbatim the access log would become a list of live credentials.
 * (The other half is that a Clerk session token expires in about a minute.)
 */
describe("redactUrl", () => {
  it("removes an SSE token", () => {
    expect(redactUrl("/api/stream?token=eyJhbGciOi.secret.sig")).toBe(
      "/api/stream?token=[redacted]"
    );
  });

  it("keeps the other parameters intact", () => {
    expect(redactUrl("/api/stream?token=secret&debug=1")).toBe(
      "/api/stream?token=[redacted]&debug=1"
    );
  });

  it("redacts a token that is not the first parameter", () => {
    expect(redactUrl("/api/stream?a=1&token=secret&b=2")).toBe(
      "/api/stream?a=1&token=[redacted]&b=2"
    );
  });

  it("leaves a URL with no query string alone", () => {
    expect(redactUrl("/api/notifications")).toBe("/api/notifications");
  });

  it("leaves other parameters' encoding untouched", () => {
    // Round-tripping through URLSearchParams would re-encode these, so the logged
    // URL would stop matching what the client actually sent.
    expect(redactUrl("/api/notifications?q=a%20b&page=2")).toBe(
      "/api/notifications?q=a%20b&page=2"
    );
  });

  it("does not redact a parameter that merely contains 'token'", () => {
    expect(redactUrl("/api/x?tokenCount=3")).toBe("/api/x?tokenCount=3");
  });

  it("redacts a token whose value itself contains an equals sign", () => {
    expect(redactUrl("/api/stream?token=abc=def")).toBe("/api/stream?token=[redacted]");
  });
});
