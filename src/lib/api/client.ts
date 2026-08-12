/**
 * Browser-side client for the Express API.
 *
 * The API is a separate origin — a separate deployment, in fact — so calls carry
 * an explicit base URL and an explicit bearer token. Nothing here reads a cookie:
 * the token comes from Clerk's `getToken()` at the call site, which is what makes
 * the API stateless and free of any CSRF surface.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** The API's correlation id, if it got far enough to issue one. */
    readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Base URL of the API service.
 *
 * `NEXT_PUBLIC_` because the browser is the caller and the value has to be
 * inlined at build time. That also means it is public, which is fine — it is a
 * hostname, and every endpoint behind it authenticates.
 */
export function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. The notification API runs as a separate " +
        "service — see .env.example, and `npm run dev:api` to start it locally."
    );
  }

  return url.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * A JSON request against the API.
 *
 * Failures become `ApiRequestError` with the status and the API's `requestId`
 * attached, so a client-side report can be matched to a server log line.
 */
export async function apiFetch<T>(
  path: string,
  opts: { token: string; method?: "GET" | "POST"; signal?: AbortSignal } = {
    token: "",
  }
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: opts.method ?? "GET",
    headers: { Authorization: `Bearer ${opts.token}`, Accept: "application/json" },
    signal: opts.signal,
    // The token is the credential; sending cookies cross-origin as well would
    // add nothing and require CORS to allow credentials.
    credentials: "omit",
  });

  if (!response.ok) {
    // An error body is expected but not guaranteed — a proxy returning 502 sends
    // HTML — so parsing it must not be what surfaces instead of the status.
    const body = await response.json().catch(() => null);
    const error = body?.error;

    throw new ApiRequestError(
      response.status,
      typeof error?.code === "string" ? error.code : "unknown",
      typeof error?.message === "string" ? error.message : response.statusText,
      typeof error?.requestId === "string" ? error.requestId : undefined
    );
  }

  return response.json() as Promise<T>;
}
