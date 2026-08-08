"use server"

import { revalidatePath } from "next/cache";
import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDb } from "../mongoose"
import { requireCurrentUser } from "../auth";
import mongoose from "mongoose";



export async function fetchPosts(pageNumber = 1, pageSize = 20) {
    await connectToDb();

    const skipAmount = (pageNumber - 1) * pageSize;
    const rootThreadQuery = { parentId: { $in: [null, undefined] } };
    const postsQuery = Thread.find(rootThreadQuery)
        .sort({ createdAt: "desc" })
        .skip(skipAmount)
        .limit(pageSize)
        .populate({
            path: "author",
            model: User,
        })
        .populate({
            path: "community",
            model: Community,
        })
        .populate({
            path: "children",
            populate: {
                path: "author",
                model: User,
                select: "_id name parentId image",
            },
        }).lean();

    const totalPostsCount = await Thread.countDocuments(rootThreadQuery);
    const posts = await postsQuery.exec();

    const isNext = totalPostsCount > skipAmount + posts.length;
    return { posts, isNext }
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

        const createThread = await Thread.create({
            text,
            author,
            community: communityIdObject?._id ?? null,
            parentId: null,
            tags,
        })

        await User.findByIdAndUpdate(author, {
            $push: { threads: createThread._id }
        })
        if (communityIdObject) {
            await Community.findByIdAndUpdate(communityIdObject, {
                $push: { threads: createThread._id }
            })
        }
        revalidatePath(path)
    } catch (error: any) {
        throw new Error(`Failed to create thread: ${error.message}`);
    }
}

export async function fetchThreadById(id: string) {
    try {
        await connectToDb();
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
        return thread
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
        const originalThread = await Thread.findById(threadId);
        if (!originalThread) {
            throw new Error("Thread not found");
        }

        const commentThread = new Thread({
            text: commentText,
            parentId: threadId,
            author: userId
        })
        const savedCommentThread = await commentThread.save();

        originalThread.children.push(savedCommentThread._id);

        await originalThread.save();
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

        const thread = await Thread.findById(threadId);
        if (!thread) {
            throw new Error("Thread not found");
        }

        const likeIndex = thread.likes.findIndex(
            (like:any) => like.userId?.toString() === userId
        );

        if (likeIndex !== -1) { 
            thread.likes.splice(likeIndex, 1);
            console.log("Like removed");

        } else {

            thread.likes.push({ userId: new mongoose.Types.ObjectId(userId),threadId:thread.id, date: new Date() });
            console.log("Like added");
        }

        await thread.save();

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

