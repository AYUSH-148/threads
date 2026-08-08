"use server"

import { revalidatePath } from "next/cache";
import Community from "../models/community.model";
import User from "../models/user.model";
import { connectToDb } from "../mongoose"
import { auth } from "@clerk/nextjs";
import Thread from "../models/thread.model";
import { getCurrentUserId } from "../auth";
import { threadCardStages } from "../aggregations/threadCard";
import mongoose, { FilterQuery, SortOrder } from "mongoose";

export async function fetchUser(userId: String) {
    try {
        await connectToDb();
        return await User.findOne({ id: userId }).populate({
            path: "communities",
            model: Community
        })
    } catch (error: any) {
        throw new Error(`Failed to fetch user: ${error.message}`);
    }
}

interface Params {
    username: string;
    name: string;
    bio: string;
    image: string;
    path: string;
}

export async function updateUser({
    bio,
    name,
    path,
    username,
    image,
}: Params): Promise<void> {
    try {
        // Onboarding runs before the User document exists, so resolve the Clerk
        // session directly here instead of via requireCurrentUser().
        const { userId: clerkId } = auth();
        if (!clerkId) throw new Error("Unauthorized");

        await connectToDb();
        await User.findOneAndUpdate(
            { id: clerkId },
            {
                username: username.toLowerCase(),
                name, bio, image, onboarded: true
            },
            { upsert: true } //insert or update
        )
        if (path === "/profile/edit") {
            revalidatePath(path); // refresh cached data and display updated info 
        }
    } catch (error: any) {
        throw new Error(`Failed to create/update user: ${error.message}`);
    }
}
export async function fetchUserPosts(accountId: String) {
    try {
        await connectToDb();
        const viewerId = await getCurrentUserId();

        // The profile header needs the account itself; the cards do not, so only
        // the four fields it renders are selected.
        const user = await User.findOne({ id: accountId })
            .select("_id id name image threads")
            .lean<{ _id: unknown; id: string; name: string; image: string; threads: unknown[] } | null>();

        if (!user) return null;

        const threads = await Thread.aggregate([
            { $match: { _id: { $in: user.threads ?? [] } } },
            { $sort: { createdAt: -1 } },
            ...threadCardStages(viewerId),
        ]);

        return { id: user.id, name: user.name, image: user.image, threads };
    } catch (error: any) {
        console.error("Error fetching user threads:", error);
        throw error;
    }
}

interface SearchQuery {
    userId: string
    searchString?: string
    pageNumber?: number
    pageSize?: number
    sortBy?: SortOrder
}

export async function fetchUsers({
    userId,
    searchString = "",
    pageNumber = 1,
    pageSize = 20,
    sortBy = "desc",
}: SearchQuery) {
    try {
        await connectToDb();
        const skipAmount = (pageNumber - 1) * pageSize;
        const regex = new RegExp(searchString, "i");

        const query: FilterQuery<typeof User> = {
            id: { $ne: userId }
        }

        if (searchString.trim() !== "") {
            query.$or = [
                { username: { $regex: regex } },
                { name: { $regex: regex } }
            ]
        }
        const sortOptions = { createdAt: sortBy };
        const usersQuery = User.find(query)
            .sort(sortOptions)
            .skip(skipAmount)
            .limit(pageSize);

        const totalUsersCount = await User.countDocuments(query);
        const users = await usersQuery.exec();
        const isNext = totalUsersCount > skipAmount + users.length;

        return { users, isNext };

    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
}

interface ReplyActivity {
    id: string;
    parentId: string | null;
    author: { id: string; name: string; image: string };
}

interface LikeActivity {
    /** The liker's Clerk id, for their profile link. */
    id: string;
    username: string;
    image: string;
    threadId: string;
    /** ISO string: formatDateString() takes one, and Dates do not serialize cleanly. */
    likedAt: string;
}

/**
 * Replies other people left on the given user's threads, newest first.
 *
 * `childIds` comes from the author's own threads; the $ne filter drops their
 * own replies so nobody is notified about themselves.
 */
async function repliesFrom(childIds: any[], userId: string): Promise<ReplyActivity[]> {
    if (childIds.length === 0) return [];

    const replies = await Thread.find({
        _id: { $in: childIds },
        author: { $ne: userId },
    })
        .select("parentId author")
        .populate({ path: "author", model: User, select: "id name image" })
        .sort({ createdAt: -1 })
        .lean();

    return replies.map((reply: any) => ({
        // Not `reply.id`: these are lean documents, so the Mongoose `id` virtual
        // does not exist and the activity page was linking to /thread/undefined.
        id: String(reply._id),
        parentId: reply.parentId ?? null,
        author: {
            id: reply.author?.id ?? "",
            name: reply.author?.name ?? "",
            image: reply.author?.image ?? "",
        },
    }));
}

/** Likes other people left on the given user's threads, newest first. */
async function likesFrom(
    ownThreads: { _id: unknown; likes?: any[] }[]
): Promise<LikeActivity[]> {
    // Carry the owning thread's _id down with each like: the denormalised
    // `like.threadId` is absent on older rows, and this one is authoritative.
    const likes = ownThreads.flatMap((thread) =>
        (thread.likes ?? []).map((like: any) => ({
            userId: like.userId,
            date: like.date,
            threadId: String(thread._id),
        }))
    );

    if (likes.length === 0) return [];

    // One query for every liker, instead of one findById per like inside a
    // Promise.all. The Set also collapses repeats — someone who liked ten of
    // your threads used to be ten identical round trips.
    const likerIds = Array.from(
        new Set(likes.map((like) => String(like.userId)).filter(Boolean))
    );

    const users = await User.find({ _id: { $in: likerIds } })
        .select("_id id username image")
        .lean();

    const usersById = new Map(users.map((user: any) => [String(user._id), user]));

    return likes
        .map((like) => {
            const user = usersById.get(String(like.userId));
            if (!user) return null;
            // Older like entries predate the `date` default, so fall back rather
            // than letting toISOString() throw on an Invalid Date.
            const likedAt = like.date ? new Date(like.date) : null;
            return {
                id: user.id,
                username: user.username,
                image: user.image,
                threadId: like.threadId,
                likedAt:
                    likedAt && !isNaN(likedAt.getTime())
                        ? likedAt.toISOString()
                        : new Date(0).toISOString(),
            };
        })
        .filter((like): like is LikeActivity => like !== null)
        .sort((a, b) => +new Date(b.likedAt) - +new Date(a.likedAt));
}

/**
 * Replies only. The profile page renders nothing but these, and computing the
 * likes alongside them meant every profile view paid for data it discarded.
 */
export async function getReplies(userId: string): Promise<ReplyActivity[]> {
    try {
        await connectToDb();

        // Only `children` is read off the user's own threads. The old query
        // fetched whole documents, dragging every likes array along with them.
        const ownThreads = await Thread.find({ author: userId })
            .select("children")
            .lean();

        return await repliesFrom(
            ownThreads.flatMap((thread: any) => thread.children ?? []),
            userId
        );
    } catch (error) {
        console.error("Error fetching replies: ", error);
        throw error;
    }
}

/** Both halves, for the activity page — which is the only caller that shows likes. */
export async function getActivity(userId: string) {
    try {
        await connectToDb();

        const ownThreads = await Thread.find({ author: userId })
            .select("likes children")
            .lean();

        // Independent of each other, so they overlap rather than queue.
        const [replies, likedUsers] = await Promise.all([
            repliesFrom(
                ownThreads.flatMap((thread: any) => thread.children ?? []),
                userId
            ),
            likesFrom(ownThreads as any),
        ]);

        return { replies, likedUsers };
    } catch (error) {
        console.error("Error fetching activity: ", error);
        throw error;
    }
}



export async function fetchFriends(userId: string) {
    try {
        await connectToDb();
        const communitiesList = await Community.find({
            members: new mongoose.Types.ObjectId(userId)
        });

        const communityIds = communitiesList.map(community => community._id);

        const users = await User.find({
            communities: { $in: communityIds }
        });

        const userList = users
            .filter(user => user._id.toString() !== userId)
            .map(user => ({
                username: user.username,
                id: user.id
            }));

        return userList;

    } catch (error) {
        console.error("Error fetching usernames: ", error);
        throw error;
    }
}