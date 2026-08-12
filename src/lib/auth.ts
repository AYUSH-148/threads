import { auth } from "@clerk/nextjs";

import { resolveUserIdByClerkId } from "./identity";

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

  const userId = await resolveUserIdByClerkId(clerkId);
  if (!userId) throw new Error("Unauthorized");

  return { clerkId, userId };
}

/**
 * Read-path counterpart to requireCurrentUser(): the viewer's Mongo _id, or
 * null when signed out.
 *
 * Feed queries need the viewer to compute `likedByMe`, but a read must not
 * throw the way a mutation does. Resolving it here rather than accepting it as
 * an argument keeps the same rule as above — a caller-supplied id is forgeable,
 * and these functions are reachable over HTTP.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId: clerkId } = auth();
  if (!clerkId) return null;

  return resolveUserIdByClerkId(clerkId);
}
