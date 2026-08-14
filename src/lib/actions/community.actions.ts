// Deliberately NOT a "use server" module.
//
// Every export of a "use server" file becomes a public HTTP endpoint the browser
// can invoke — which would let anyone call deleteCommunity() or
// removeUserFromCommunity() directly. These are only ever called from server
// components and the Clerk webhook handler, so keeping them as plain
// server-side functions removes that surface entirely.

import { FilterQuery, SortOrder } from "mongoose";

import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";

import { connectToDb } from "../mongoose";
import { getCurrentUserId } from "../auth";
import { threadCardStages } from "../aggregations/threadCard";

export async function createCommunity(
  id: string,
  name: string ,
  username: string,
  image: string,
  bio: string,
  createdById: string // Change the parameter name to reflect it's an id
) {
  try {
    await connectToDb();

    // Find the user with the provided unique id
    const user = await User.findOne({ id: createdById });

    if (!user) {
      throw new Error("User not found"); // Handle the case if the user with the id is not found
    }

    const newCommunity = new Community({
      id,
      name,
      username,
      image,
      bio,
      createdBy: user._id, // Use the mongoose ID of the user
    });

    const createdCommunity = await newCommunity.save();

    // Update User model
    user.communities.push(createdCommunity._id);
    await user.save();

    return createdCommunity;
  } catch (error) {
    // Handle any errors
    console.error("Error creating community:", error);
    throw error;
  }
}

interface LeanCommunityCard {
  _id: any;
  id: string;
  name: string;
  username: string;
  image: string;
  bio: string;
  members?: { _id: any; image: string }[];
}

interface LeanCommunityDetails {
  _id: any;
  id: string;
  name: string;
  username: string;
  image: string;
  bio: string;
  threads: any[];
  createdBy: { _id: any; id: string; name: string; image: string };
  members: { _id: any; id: string; name: string; username: string; image: string }[];
}

export async function fetchCommunityDetails(id: string) {
  try {
    await connectToDb();

    const communityDetails = await Community.findOne({ id })
      .select("_id id name username image bio threads")
      .populate([
        // The bare "createdBy" populate pulled the full author document to read
        // a single id off it.
        { path: "createdBy", model: User, select: "_id id name image" },
        {
          path: "members",
          model: User,
          select: "name username image _id id",
        },
      ])
      .lean<LeanCommunityDetails | null>();

    return communityDetails;
  } catch (error) {
    // Handle any errors
    console.error("Error fetching community details:", error);
    throw error;
  }
}

export async function fetchCommunityPosts(id: string) {
  try {
    await connectToDb();
    const viewerId = await getCurrentUserId();

    const community = await Community.findById(id)
      .select("_id id name image threads")
      .lean<{ id: string; name: string; image: string; threads: unknown[] } | null>();

    if (!community) return null;

    const threads = await Thread.aggregate([
      { $match: { _id: { $in: community.threads ?? [] } } },
      { $sort: { createdAt: -1 } },
      ...threadCardStages(viewerId),
    ]);

    return {
      id: community.id,
      name: community.name,
      image: community.image,
      threads,
    };
  } catch (error) {
    // Handle any errors
    console.error("Error fetching community posts:", error);
    throw error;
  }
}

export async function fetchCommunities({
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
  includeMembers = true,
}: {
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
  /** Off for callers that render no member avatars — see the populate below. */
  includeMembers?: boolean;
}) {
  try {
    await connectToDb();

    // Calculate the number of communities to skip based on the page number and page size.
    const skipAmount = (pageNumber - 1) * pageSize;

    // Create a case-insensitive regular expression for the provided search string.
    const regex = new RegExp(searchString, "i");

    // Create an initial query object to filter communities.
    const query: FilterQuery<typeof Community> = {};

    // If the search string is not empty, add the $or operator to match either username or name fields.
    if (searchString.trim() !== "") {
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    // Define the sort options for the fetched communities based on createdAt field and provided sort order.
    const sortOptions = { createdAt: sortBy };

    // Create a query to fetch the communities based on the search and sort criteria.
    const communitiesQuery = Community.find(query)
      .sort(sortOptions)
      .skip(skipAmount)
      .limit(pageSize)
      .select("_id id name username image bio");

    // `.populate("members")` with no select pulled every member's full user
    // document — bio, communities, entire threads array — to render an avatar.
    // RightSidebar renders no avatars at all and lives in the layout, so it was
    // paying for that join on every page load in the app.
    if (includeMembers) {
      communitiesQuery.populate({
        path: "members",
        model: User,
        select: "_id image",
      });
    }

    // Count the total number of communities that match the search criteria (without pagination).
    const totalCommunitiesCount = await Community.countDocuments(query);

    const communities = await communitiesQuery.lean<LeanCommunityCard[]>().exec();

    // Check if there are more communities beyond the current page.
    const isNext = totalCommunitiesCount > skipAmount + communities.length;

    return { communities, isNext };
  } catch (error) {
    console.error("Error fetching communities:", error);
    throw error;
  }
}

export async function addMemberToCommunity(
  communityId: string,
  memberId: string
) {
  try {
    await connectToDb();

    // Find the community by its unique id
    const community = await Community.findOne({ id: communityId });

    if (!community) {
      throw new Error("Community not found");
    }

    // Find the user by their unique id
    const user = await User.findOne({ id: memberId });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if the user is already a member of the community
    if (community.members.includes(user._id)) {
      throw new Error("User is already a member of the community");
    }

    // Add the user's _id to the members array in the community
    community.members.push(user._id);
    await community.save();

    // Add the community's _id to the communities array in the user
    user.communities.push(community._id);
    await user.save();

    return community;
  } catch (error) {
    // Handle any errors
    console.error("Error adding member to community:", error);
    throw error;
  }
}

export async function removeUserFromCommunity(
  userId: string,
  communityId: string
) {
  try {
    await connectToDb();

    const userIdObject = await User.findOne({ id: userId }, { _id: 1 });
    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    if (!userIdObject) {
      throw new Error("User not found");
    }

    if (!communityIdObject) {
      throw new Error("Community not found");
    }

    // Remove the user's _id from the members array in the community
    await Community.updateOne(
      { _id: communityIdObject._id },
      { $pull: { members: userIdObject._id } }
    );

    // Remove the community's _id from the communities array in the user
    await User.updateOne(
      { _id: userIdObject._id },
      { $pull: { communities: communityIdObject._id } }
    );

    return { success: true };
  } catch (error) {
    // Handle any errors
    console.error("Error removing user from community:", error);
    throw error;
  }
}

export async function updateCommunityInfo(
  communityId: string,
  name: string,
  username: string,
  image: string
) {
  try {
    await connectToDb();

    // Find the community by its _id and update the information
    const updatedCommunity = await Community.findOneAndUpdate(
      { id: communityId },
      { name, username, image }
    );

    if (!updatedCommunity) {
      throw new Error("Community not found");
    }

    return updatedCommunity;
  } catch (error) {
    // Handle any errors
    console.error("Error updating community information:", error);
    throw error;
  }
}

export async function deleteCommunity(communityId: string) {
  try {
    await connectToDb();

    // Find the community by its ID and delete it
    const deletedCommunity = await Community.findOneAndDelete({
      id: communityId,
    });

    if (!deletedCommunity) {
      throw new Error("Community not found");
    }

    // Delete all threads associated with the community
    await Thread.deleteMany({ community: communityId });

    // Find all users who are part of the community
    const communityUsers = await User.find({ communities: communityId });

    // Remove the community from the 'communities' array for each user
    const updateUserPromises = communityUsers.map((user) => {
      user.communities.pull(communityId);
      return user.save();
    });

    await Promise.all(updateUserPromises);

    return deletedCommunity;
  } catch (error) {
    console.error("Error deleting community: ", error);
    throw error;
  }
}
