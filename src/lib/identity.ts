import User from "./models/user.model";
import { connectToDb } from "./mongoose";

/**
 * Clerk id to the Mongo `_id` that documents reference.
 *
 * Deliberately free of any framework import. `auth.ts` is the Next.js-flavoured
 * caller (it reads the id out of the request via `@clerk/nextjs`), and the API
 * service's auth middleware is the Express one (it reads the id out of a verified
 * JWT). Both need the same lookup, and neither can import the other's runtime:
 * `@clerk/nextjs` pulls in `next/headers`, which throws outside a Next request.
 */
export async function resolveUserIdByClerkId(clerkId: string): Promise<string | null> {
  await connectToDb();

  const user = await User.findOne({ id: clerkId })
    .select("_id")
    .lean<{ _id: unknown } | null>();

  return user ? String(user._id) : null;
}
