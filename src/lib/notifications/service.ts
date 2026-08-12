import mongoose from "mongoose";

import Notification from "../models/notification.model";
import { connectToDb } from "../mongoose";
import { mapNotificationRow } from "./map";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type NotificationAggregateRow,
  type NotificationPage,
} from "./types";

/**
 * Reads of the materialised notification collection.
 *
 * Framework-free on purpose: these are called by the Express API (for the
 * client) and directly by Server Components (for the first render). Neither
 * `next/*` nor `express` appears here, so there is one implementation of the
 * query rather than one per transport.
 *
 * Every function takes the viewer's id as an argument and none of them work it
 * out. Resolving identity is the caller's job — the Server Component gets it
 * from the session, the API from a verified JWT — and a function that accepted an
 * id *and* trusted it would be the same forgeable-parameter bug the auth
 * helpers exist to prevent.
 */

/**
 * One page of a viewer's notifications, newest first.
 *
 * Served entirely by the { recipient, lastActorAt } index. This replaced
 * deriving the feed per page view, which loaded every thread the viewer had ever
 * authored and flattened every embedded like in memory — work proportional to
 * account history rather than to page size.
 */
export async function listNotifications(
  userId: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<NotificationPage> {
  const { page, pageSize } = clampPaging(opts);

  await connectToDb();
  const skipAmount = (page - 1) * pageSize;

  // One row more than the page renders: if it comes back there is a next page,
  // which answers isNext without a second countDocuments round trip.
  const rows: NotificationAggregateRow[] = await Notification.aggregate([
    { $match: { recipient: new mongoose.Types.ObjectId(userId) } },
    { $sort: { lastActorAt: -1 } },
    { $skip: skipAmount },
    { $limit: pageSize + 1 },
    {
      $addFields: {
        actorCount: { $size: { $ifNull: ["$actors", []] } },
        // Actors are appended, so the tail is the most recent. Only the three
        // the UI names are joined; the rest stay a number.
        previewActorIds: {
          $reverseArray: { $slice: [{ $ifNull: ["$actors", []] }, -3] },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "previewActorIds",
        foreignField: "_id",
        as: "previewActors",
        pipeline: [{ $project: { _id: 1, id: 1, name: 1, username: 1, image: 1 } }],
      },
    },
    {
      $lookup: {
        from: "threads",
        localField: "threadId",
        foreignField: "_id",
        as: "thread",
        pipeline: [{ $project: { text: 1 } }],
      },
    },
    { $unwind: { path: "$thread", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        kind: 1,
        threadId: 1,
        lastActorAt: 1,
        readAt: 1,
        actorCount: 1,
        previewActorIds: 1,
        previewActors: 1,
        threadPreview: { $ifNull: ["$thread.text", ""] },
      },
    },
  ]);

  return {
    notifications: rows.slice(0, pageSize).map(mapNotificationRow),
    isNext: rows.length > pageSize,
  };
}

/**
 * Unread count for the badge.
 *
 * Called once per connected viewer each time the SSE channel reports activity,
 * so it is kept to a single count covered by { recipient, readAt } rather than
 * joining anything.
 */
export async function countUnread(userId: string): Promise<number> {
  await connectToDb();

  return Notification.countDocuments({
    recipient: new mongoose.Types.ObjectId(userId),
    readAt: null,
  });
}

/** Clears the badge. Returns how many rows changed, which the API reports back. */
export async function markAllRead(userId: string): Promise<number> {
  await connectToDb();

  const result = await Notification.updateMany(
    { recipient: new mongoose.Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } }
  );

  return result.modifiedCount ?? 0;
}

/**
 * Second line of defence behind the API's request validation.
 *
 * The API rejects a bad `page` with a 400 before reaching here, but this module
 * is also called directly by Server Components reading `searchParams`, where
 * `?page=-3` would otherwise become a negative `$skip` and make MongoDB throw.
 */
function clampPaging({ page, pageSize }: { page?: number; pageSize?: number }) {
  return {
    page: Math.max(1, Math.floor(page ?? 1)),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE))),
  };
}
