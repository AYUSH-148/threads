import { describe, expect, it } from "vitest";

import { extractToken } from "./auth";

describe("extractToken", () => {
  it("reads a bearer token from the Authorization header", () => {
    expect(extractToken("Bearer abc.def.ghi", undefined)).toBe("abc.def.ghi");
  });

  it("accepts any capitalisation of the scheme", () => {
    // The scheme is a case-insensitive token per RFC 7235, and fetch wrappers are
    // not consistent about it.
    expect(extractToken("bearer abc", undefined)).toBe("abc");
    expect(extractToken("BEARER abc", undefined)).toBe("abc");
  });

  it.each(["Basic abc", "abc", "Bearer", "Bearer   "])(
    "rejects %j as an Authorization header",
    (header) => {
      expect(extractToken(header, undefined)).toBeNull();
    }
  );

  /**
   * The one caller for the query parameter is the SSE endpoint: `EventSource`
   * cannot set request headers, so there is no version of it that authenticates
   * over one without giving up the browser's built-in streaming client.
   */
  it("falls back to a query token", () => {
    expect(extractToken(undefined, "abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("prefers the header when both are present", () => {
    expect(extractToken("Bearer from-header", "from-query")).toBe("from-header");
  });

  it("does not let a query token rescue a malformed header", () => {
    // Otherwise a client could send a deliberately broken header to smuggle the
    // credential through the less-scrutinised path.
    expect(extractToken("Basic nope", "from-query")).toBeNull();
  });

  it("refuses a request carrying two tokens", () => {
    // Express parses repeated parameters into an array. No legitimate client
    // sends two, so it is refused rather than resolved by picking one.
    expect(extractToken(undefined, ["a", "b"])).toBeNull();
  });

  it.each([undefined, "", null, 42, {}])("rejects %j as a query token", (value) => {
    expect(extractToken(undefined, value)).toBeNull();
  });
});
