"use server"

import { revalidatePath } from "next/cache";
import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDb } from "../mongoose"
import { getCurrentUserId, requireCurrentUser } from "../auth";
import { threadCardStages, toThreadCardFields } from "../aggregations/threadCard";
import { withTransaction } from "../db/transaction";
import { emit } from "../events/emit";
import mongoose from "mongoose";



export async function fetchPosts(pageNumber = 1, pageSize = 20) {
    await connectToDb();
    const viewerId = await getCurrentUserId();

    const skipAmount = (pageNumber - 1) * pageSize;

    // Ask for one document more than the page renders: if it comes back there
    // is a next page. That answers isNext without the second countDocuments()
    // round trip the old version paid on every feed render.
    const rows = await Thread.aggregate([
        { $match: { parentId: { $in: [null, undefined] } } },
        // Served in order by the { parentId: 1, createdAt: -1 } index, so the
        // page is picked before any of the joins below run.
        { $sort: { createdAt: -1 } },
        { $skip: skipAmount },
        { $limit: pageSize + 1 },
        ...threadCardStages(viewerId),
    ]);

    return { posts: rows.slice(0, pageSize), isNext: rows.length > pageSize };
}

interface ThreadParams {
    text: string,
    communityId: string | null
    path: string
    tags: string[] | null
}

export async function createThread({ text, communityId, path, tags }: ThreadParams) {
    try {
        const { userId: author } = await requireCurrentUser();
        await connectToDb();
        const communityIdObject = await Community.findOne({ id: communityId }, { _id: 1 }) //including _id in result

        // Three writes that have to agree with each other: the thread, the
        // author's thread list, and the community's. Previously a failure
        // between them left a thread nobody's profile listed.
        await withTransaction(async (session) => {
            const [thread] = await Thread.create(
                [{
                    text,
                    author,
                    community: communityIdObject?._id ?? null,
                    parentId: null,
                    tags,
                }],
                { session }
            );

            await User.updateOne(
                { _id: author },
                { $push: { threads: thread._id } },
                { session }
            );

            if (communityIdObject) {
                await Community.updateOne(
                    { _id: communityIdObject._id },
                    { $push: { threads: thread._id } },
                    { session }
                );

                // Fans out to every member in the worker. Doing it here would
                // make the poster wait on one write per member.
                await emit(session, "community.thread.created", author, {
                    threadId: String(thread._id),
                    communityId: String(communityIdObject._id),
                });
            }
        });

        revalidatePath(path)
    } catch (error: any) {
        throw new Error(`Failed to create thread: ${error.message}`);
    }
}

export async function fetchThreadById(id: string) {
    try {
        await connectToDb();
        const viewerId = await getCurrentUserId();
        const thread = await Thread.findById(id).populate({
            path: "author",
            model: User,
            select: "name id _id image"
        }).populate({
            path: "community",
            model: Community,
            select: "name _id id image"
        }).populate({
            path: "children",
            model: Thread,
            populate: [
                {
                    path: "author",
                    model: User,
                    select: "_id id name parentId image"
                }, {
                    path: "children",
                    model: Thread,
                    populate: {
                        path: "author",
                        model: User,
                        select: "_id id name parentId image",
                    }
                }
            ]
        }).lean().exec();

        if (!thread) return null;

        // The detail page really does render every comment, so `children` stays.
        // `likes` does not — it is collapsed to the same scalars the feed uses
        // and dropped, at both levels of the tree.
        const withCardFields = (node: any) => {
            const { likes, ...rest } = node;
            return { ...rest, ...toThreadCardFields(node, viewerId) };
        };

        const root = thread as any;
        return {
            ...withCardFields(root),
            children: (root.children ?? []).map(withCardFields),
        };
    } catch (error) {
        console.error("Error while fetching thread:", error);
        throw new Error("Unable to fetch thread");
    }
}

export async function deleteThread(id: string, path: string) {
    try {
        const { userId } = await requireCurrentUser();
        await connectToDb();
        const mainThread = await Thread.findById(id)
            .populate(
                {
                    path: "author",
                    model: User
                },
            ).populate(
                {
                    path: "community",
                    model: Community
                }
            )
        if (!mainThread) {
            throw new Error("Thread Not found")
        }
        if (mainThread.author?._id?.toString() !== userId) {
            throw new Error("Not allowed to delete this thread")
        }

        const descendantThreads = await fetchAllChildThreads(id);
        const descendantThreadIds = [
            id,
            ...descendantThreads.map((thread) => thread._id),
        ];

        const uniqueAuthorIds = new Set(
            [
                ...descendantThreads.map((thread) => thread.author?._id?.toString()), // Use optional chaining to handle possible undefined values
                mainThread.author?._id?.toString(),
            ].filter((id) => id !== undefined)
        );

        const uniqueCommunityIds = new Set(
            [
                ...descendantThreads.map((thread) => thread.community?._id?.toString()), // Use optional chaining to handle possible undefined values
                mainThread.community?._id?.toString(),
            ].filter((id) => id !== undefined)
        );

        await Thread.deleteMany({ _id: { $in: descendantThreadIds } });


        await User.updateMany(
            { _id: { $in: Array.from(uniqueAuthorIds) } },
            { $pull: { threads: { $in: descendantThreadIds } } }
        );
        await Community.updateMany(
            { _id: { $in: Array.from(uniqueCommunityIds) } },
            { $pull: { threads: { $in: descendantThreadIds } } }
        );

        revalidatePath(path);
    } catch (error: any) {
        throw new Error(`Failed to delete thread: ${error.message}`);
    }
}

async function fetchAllChildThreads(threadId: string): Promise<any[]> {
    const childThreads = await Thread.find({ parentId: threadId });

    const descendantThreads = [];
    for (const childThread of childThreads) {
        const descendants = await fetchAllChildThreads(childThread._id);
        descendantThreads.push(childThread, ...descendants);
    }

    return descendantThreads;
}

export async function addCommentToThread(
    threadId: string,
    commentText: string,
    path: string
) {
    try {
        const { userId } = await requireCurrentUser();
        await connectToDb();

        await withTransaction(async (session) => {
            // Only `author` is read: it is the notification recipient, and
            // loading the whole parent would drag its likes and children arrays
            // into memory to append one id.
            const parent = await Thread.findById(threadId)
                .select("author")
                .session(session)
                .lean<{ author: unknown } | null>();

            if (!parent) throw new Error("Thread not found");

            const [comment] = await Thread.create(
                [{ text: commentText, parentId: threadId, author: userId }],
                { session }
            );

            // $push appends server-side. save() rewrote the whole array, so two
            // people commenting at once could drop one of the two comments.
            await Thread.updateOne(
                { _id: threadId },
                { $push: { children: comment._id } },
                { session }
            );

            await emit(session, "thread.commented", userId, {
                threadId: String(threadId),
                commentId: String(comment._id),
                threadAuthorId: String(parent.author),
            });
        });

        revalidatePath(path)
    } catch (err: any) {
        console.error("Error while adding comment:", err);
        throw new Error("Unable to add comment");
    }
}

export async function handleLikeToThread(threadId: string, path: string) {
    try {
        const { userId } = await requireCurrentUser();
        await connectToDb();

        const viewerId = new mongoose.Types.ObjectId(userId);

        await withTransaction(async (session) => {
            const thread = await Thread.findById(threadId)
                .select("author")
                .session(session)
                .lean<{ author: unknown } | null>();

            if (!thread) throw new Error("Thread not found");

            // Toggle as two conditional atomic updates rather than
            // read-modify-save. The old version loaded every like into memory to
            // flip one of them, and save() wrote the whole array back — so two
            // people liking the same thread at once would clobber each other.
            const unliked = await Thread.updateOne(
                { _id: threadId, "likes.userId": viewerId },
                { $pull: { likes: { userId: viewerId } } },
                { session }
            );

            // Unliking emits nothing: there is no notification to send, and
            // retracting one the recipient may already have seen is worse than
            // leaving it. Only the like direction is an event.
            if (unliked.matchedCount > 0) return;

            // The $ne guard makes the insert idempotent: a double-submit cannot
            // produce two like entries for the same user.
            const liked = await Thread.updateOne(
                { _id: threadId, "likes.userId": { $ne: viewerId } },
                { $push: { likes: { userId: viewerId, threadId, date: new Date() } } },
                { session }
            );

            // Neither branch matched, so the thread itself is gone.
            if (liked.matchedCount === 0) {
                throw new Error("Thread not found");
            }

            await emit(session, "thread.liked", userId, {
                threadId: String(threadId),
                threadAuthorId: String(thread.author),
            });
        });

        revalidatePath(path);
    } catch (error) {
        console.error("Error while adding like", error);
        throw new Error("Unable to add like");
    }
}


export async function fetchtaggedByUsers(userId: string) {

    try {
        await connectToDb(); 
        const threadsList = await Thread.find({ tags: userId }).select("_id createdAt")
        .populate({
            path: 'author',
            model: User,
            select: '_id id username image', 
        }).lean()
        .exec()

        console.log(threadsList)
      
        return threadsList;
    } catch (err) {
        console.error("Error while fetching tags", err);
        throw new Error("Unable to fetch tagged data");
    }
}

