"use server"

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";

import { getCurrentUserId, requireCurrentUser } from "../auth";
import Notification from "../models/notification.model";
import { connectToDb } from "../mongoose";

export interface NotificationActor {
  /** Clerk id, for the profile link. */
  id: string;
  name: string;
  username: string;
  image: string;
}

export interface NotificationRow {
  id: string;
  kind: "like" | "reply" | "community_post";
  threadId: string;
  /** Up to three contributors, most recent first. */
  actors: NotificationActor[];
  /** Everyone, including the actors not in the preview. */
  actorCount: number;
  /** ISO string — Dates do not survive the server/client boundary cleanly. */
  lastActorAt: string;
  unread: boolean;
  threadPreview: string;
}

/**
 * One page of the viewer's notifications, newest first.
 *
 * Served entirely by the { recipient, lastActorAt } index. This replaces
 * getActivity(), which loaded every thread the viewer had ever authored and
 * flattened every embedded like in memory on each page view — work proportional
 * to account history rather than to page size.
 */
export async function fetchNotifications(pageNumber = 1, pageSize = 20) {
  const userId = await getCurrentUserId();
  if (!userId) return { notifications: [] as NotificationRow[], isNext: false };

  await connectToDb();
  const skipAmount = (pageNumber - 1) * pageSize;

  // One row more than the page renders: if it comes back there is a next page,
  // which answers isNext without a second countDocuments round trip.
  const rows = await Notification.aggregate([
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

  const notifications: NotificationRow[] = rows.slice(0, pageSize).map((row: any) => {
    // $lookup does not preserve the order of the localField array, so recency
    // order has to be restored from previewActorIds.
    const byId = new Map(
      (row.previewActors ?? []).map((actor: any) => [String(actor._id), actor])
    );

    const actors = (row.previewActorIds ?? [])
      .map((actorId: unknown) => byId.get(String(actorId)))
      .filter(Boolean)
      .map((actor: any) => ({
        id: actor.id ?? "",
        name: actor.name ?? "",
        username: actor.username ?? "",
        image: actor.image ?? "",
      }));

    return {
      id: String(row._id),
      kind: row.kind,
      threadId: String(row.threadId),
      actors,
      actorCount: row.actorCount ?? 0,
      lastActorAt: new Date(row.lastActorAt).toISOString(),
      unread: row.readAt == null,
      threadPreview:
        typeof row.threadPreview === "string" ? row.threadPreview.slice(0, 120) : "",
    };
  });

  return { notifications, isNext: rows.length > pageSize };
}

/**
 * Unread count for the badge.
 *
 * Called by the client each time the SSE channel reports activity, so it is
 * kept to a single covered count rather than joining anything.
 */
export async function getUnreadCount(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  await connectToDb();
  return Notification.countDocuments({
    recipient: new mongoose.Types.ObjectId(userId),
    readAt: null,
  });
}

/** Clears the badge. Identity comes from the session, never from an argument. */
export async function markAllNotificationsRead(): Promise<void> {
  const { userId } = await requireCurrentUser();

  await Notification.updateMany(
    { recipient: new mongoose.Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } }
  );

  revalidatePath("/activity");
}
