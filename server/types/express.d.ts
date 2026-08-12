import type { Logger } from "../logger";
import type { Viewer } from "../ports";

/**
 * Fields the middleware chain attaches to the request.
 *
 * Declared once here rather than cast at each use site, so that a handler reading
 * `req.viewer!.userId` without `requireAuth` in front of it is a type error
 * rather than a runtime crash.
 */
declare global {
  namespace Express {
    interface Request {
      /** Correlation id: the inbound X-Request-Id if there was one, else generated. */
      id: string;
      /** A logger bound to this request's id. */
      log: Logger;
      /** Set by requireAuth. Absent on public routes and before authentication. */
      viewer?: Viewer;
    }
  }
}
