import mongoose, { type ClientSession } from "mongoose";

import { connectToDb } from "../mongoose";

/**
 * Runs `fn` inside a MongoDB transaction.
 *
 * Every write in the callback must be passed `{ session }` or it will commit
 * outside the transaction — silently, with no error. That is the one way to get
 * this wrong, so it is worth checking each call site.
 *
 * Note that the driver may run `fn` more than once: withTransaction retries the
 * whole callback on transient errors such as a write conflict. Keep it free of
 * side effects that are not themselves part of the transaction.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  await connectToDb();

  const session = await mongoose.startSession();
  try {
    // The driver's withTransaction resolves with the *commit* result, not with
    // whatever the callback returned, so the value has to be carried out in a
    // closure. Assigning on each attempt is correct: a retry overwrites it with
    // the result of the attempt that actually committed.
    let result!: T;
    await session.withTransaction(async (activeSession) => {
      result = await fn(activeSession);
    });
    return result;
  } catch (error: any) {
    // Standalone mongod cannot do this, and the driver's own message does not
    // say what to do about it.
    if (/replica set|Transaction numbers|not supported/i.test(String(error?.message))) {
      throw new Error(
        "MongoDB transactions require a replica set. Atlas (including M0) is one; " +
          "a standalone mongod is not — run `docker compose up -d` for a local " +
          "single-node replica set and point MONGODB_URL at it. " +
          `Original error: ${error.message}`
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
