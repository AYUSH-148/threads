import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

/**
 * An error with an HTTP status attached.
 *
 * Handlers throw these; the handler below is the only place that decides what a
 * client sees. The alternative — every route composing its own `res.status(...)`
 * error body — is how two endpoints end up returning different shapes for the
 * same condition.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message, "unauthorized");
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message, "not_found");
  }

  static unavailable(message = "A dependency is unavailable") {
    return new ApiError(503, message, "unavailable");
  }

  static rateLimited(message = "Too many requests") {
    return new ApiError(429, message, "rate_limited");
  }
}

/** Terminates the chain with a 404 rather than Express's default HTML page. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}`));
};

/**
 * The single place an exception becomes a response.
 *
 * Express recognises this as error middleware only because it declares four
 * parameters, which is why `_next` is present and unused. In Express 5 a
 * rejected promise from an `async` handler arrives here on its own — under
 * Express 4 every handler needed a try/catch or a wrapper to avoid a hung request.
 */
export function errorHandler(opts: { isProduction: boolean }): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const { status, code, message, details } = classify(err, opts.isProduction);

    // A 5xx is a bug in this service and gets the stack; a 4xx is the client
    // being told no, and logging a stack for every expired token is just noise.
    if (status >= 500) {
      req.log?.error("unhandled error", {
        status,
        code,
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      });
    } else {
      req.log?.warn("request rejected", { status, code, reason: message });
    }

    // The client may already be mid-stream — an SSE connection that fails after
    // its headers went out cannot be given a status code. Ending the response is
    // all that is left.
    if (res.headersSent) {
      res.end();
      return;
    }

    res.status(status).json({
      error: { code, message, requestId: req.id, ...(details ? { details } : {}) },
    });
  };
}

function classify(err: unknown, isProduction: boolean) {
  if (err instanceof ApiError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }

  // Validation failures reach here from `schema.parse()` in the routes. The
  // issue list is echoed back because the caller genuinely needs to know which
  // parameter was wrong — unlike a 500, there is nothing internal in it.
  if (err instanceof ZodError) {
    return {
      status: 400,
      code: "invalid_request",
      message: "Request validation failed",
      details: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  // Errors from middleware we did not write — chiefly body-parser, which throws a
  // SyntaxError carrying `status: 400` on a malformed JSON body. Without this
  // branch a client's bad request would be reported as this service's 500, and
  // logged with a stack trace as though it were a bug here.
  if (isHttpError(err)) {
    return {
      status: err.status,
      code: err.status === 400 ? "invalid_request" : "request_rejected",
      message: err.status === 400 ? "Malformed request body" : err.message,
      details: undefined as unknown,
    };
  }

  return {
    status: 500,
    code: "internal_error",
    // In production the message is fixed. An unexpected error's message is
    // written for whoever is debugging it and regularly contains a connection
    // string, a query, or a file path — none of which belongs in a response.
    message: isProduction
      ? "Something went wrong"
      : err instanceof Error
        ? err.message
        : String(err),
    details: undefined as unknown,
  };
}

/**
 * An Express-convention error: any thrown value carrying a 4xx/5xx `status`.
 *
 * Only 4xx is honoured. A library reporting its own 500 is still an internal
 * failure and should go through the branch that hides the message in production.
 */
function isHttpError(err: unknown): err is Error & { status: number } {
  if (!(err instanceof Error)) return false;

  const status = (err as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}
