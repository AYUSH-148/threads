import {
  countUnread,
  listNotifications,
  markAllRead,
} from "../../src/lib/notifications/service";
import type { NotificationsPort } from "../ports";

/**
 * Binds the port to the shared query module.
 *
 * Thin by design. The queries live in src/lib/notifications/ because the
 * activity page's first render calls them directly too — one aggregation
 * pipeline, not one per transport — and this file exists only so the routes
 * depend on an interface they can be tested against.
 */
export function createMongoNotifications(): NotificationsPort {
  return {
    list: (userId, opts) => listNotifications(userId, opts),
    countUnread: (userId) => countUnread(userId),
    markAllRead: (userId) => markAllRead(userId),
  };
}
