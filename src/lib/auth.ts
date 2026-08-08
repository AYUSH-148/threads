import { auth } from "@clerk/nextjs";

import User from "./models/user.model";
import { connectToDb } from "./mongoose";

/**
 * Resolves the signed-in Clerk session to its User document.
 *
 * Server Actions are public HTTP endpoints, so anything the browser sends can be
 * forged. Identity must always be derived here rather than read from an id the
 * caller passed in.
 *
 * Returns both ids the app uses: the Clerk id (`clerkId`) and the Mongo _id
 * (`userId`) that documents reference.
 */
export async function requireCurrentUser() {
  const { userId: clerkId } = auth();
  if (!clerkId) throw new Error("Unauthorized");

  await connectToDb();
  const user = await User.findOne({ id: clerkId }).select("_id id");
  if (!user) throw new Error("Unauthorized");

  return { clerkId, userId: user._id.toString() };
}
