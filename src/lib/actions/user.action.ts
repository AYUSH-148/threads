"use server"

import { revalidatePath } from "next/cache";
import Community from "../models/community.model";
import User from "../models/user.model";
import { connectToDb } from "../mongoose"
import Thread from "../models/thread.model";
import mongoose, { FilterQuery, SortOrder } from "mongoose";

export async function fetchUser(userId: String) {
    try {
        connectToDb();
        return await User.findOne({ id: userId }).populate({
            path: "communities",
            model: Community
        })
    } catch (error: any) {
        throw new Error(`Failed to fetch user: ${error.message}`);
    }
}

interface Params {
    userId: string;
    username: string;
    name: string;
    bio: string;
    image: string;
    path: string;
}

export async function updateUser({
    userId,
    bio,
    name,
    path,
    username,
    image,
}: Params): Promise<void> {
    try {
        connectToDb();
        await User.findOneAndUpdate(
            { id: userId },
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
export async function fetchUserPosts(userId: String) {
    try {
        connectToDb();
        const threads = await User.findOne({ id: userId }).populate({
            path: "threads",
            model: Thread,
            populate: [
                {
                    path: "community",
                    model: Community,
                    select: "name image _id"
                },
                {
                    path: "children",
                    model: Thread,
                    populate: {
                        path: "author",
                        model: User,
                        select: "name image _id"
                    },
                },
            ],
        });
        return threads;
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
        connectToDb();
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

export async function getActivity(userId: string) {
    try {
        connectToDb();

        const userThreads = await Thread.find({ author: userId });

        const childThreadIds = userThreads.reduce((acc, userThread) => {
            return acc.concat(userThread.children);
        }, []);

        const replies = await Thread.find({
            _id: { $in: childThreadIds },
            author: { $ne: userId },
        }).populate({
            path: "author",
            model: User,
            select: "name image _id",
        });

        return replies;
    } catch (error) {
        console.error("Error fetching replies: ", error);
        throw error;
    }
}

export async function fetchFriends(userId: string) {
    try {
        connectToDb();
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
                id:user.id
            }));

        return userList;

    } catch (error) {
        console.error("Error fetching usernames: ", error);
        throw error;
    }
}