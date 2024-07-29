"use server"

import { revalidatePath } from "next/cache";
import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDb } from "../mongoose"

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
    connectToDb();

    const skipAmount = (pageNumber-1)*pageSize;
    const postsQuery = Thread.find({ parentId: { $in: [null, undefined] } })
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
    });

    const totalPostsCount = await Thread.countDocuments({
        parentId: { $in: [null, undefined] },
    });
    const posts = await postsQuery.exec();

    const isNext = totalPostsCount > skipAmount + posts.length;
    return {posts,isNext}
}

interface ThreadParams {
    text: string,
    author: string,
    communityId: string | null
    path: string
}

export async function createThread({ text, author, communityId, path }: ThreadParams) {
    try {
        connectToDb();
        const communityIdObject = await Community.findOne({ id: communityId }, { _id: 1 }) //including _id in result

        const createThread = await Thread.create({
            text, author, community: communityIdObject
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
        connectToDb();
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
        }).exec();
        return thread
    } catch (error) {
        console.error("Error while fetching thread:", error);
        throw new Error("Unable to fetch thread");
    }
}

export async function deleteThread(id: string, path: string) {
    try {
        connectToDb();
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
    } catch (error:any) {
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
    threadId:string,
    commentText:string,
    userId:string,
    path:string
){
    connectToDb();
    try {
        const originalThread = await Thread.findById(threadId);
        if(!originalThread){
            throw new Error("Thread not found");
        }

        const commentThread = new Thread({
            text:commentText,
            parentId:threadId,
            author:userId
        })
        const savedCommentThread = await commentThread.save();

        originalThread.children.push(savedCommentThread._id);
        
        await originalThread.save();
        revalidatePath(path)
    } catch (err:any) {
        console.error("Error while adding comment:", err);
        throw new Error("Unable to add comment");
    }
}