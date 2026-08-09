/**
 * End-to-end check of the notification pipeline.
 *
 *   npm run verify:pipeline
 *
 * Steps the pipeline one cycle at a time — emit, relay, consume — instead of
 * racing the worker's background loops, so each stage can be asserted on its
 * own. It proves the three claims the architecture rests on:
 *
 *   1. a domain write and its event commit atomically,
 *   2. redelivering an event does not duplicate or double-count anything,
 *   3. new activity resurfaces a notification the recipient has already read,
 *      while a redelivery of activity they have seen does not.
 *
 * Creates disposable documents prefixed `__verify_` and removes them in a
 * finally block. It writes to whatever MONGODB_URL points at, so run it against
 * a development database.
 */
import { randomUUID } from "crypto";

import mongoose from "mongoose";

import { withTransaction } from "../src/lib/db/transaction";
import { emit } from "../src/lib/events/emit";
import { RedisStreamBus } from "../src/lib/events/redis-stream";
import type { DomainEvent } from "../src/lib/events/types";
import Notification from "../src/lib/models/notification.model";
import Outbox from "../src/lib/models/outbox.model";
import Thread from "../src/lib/models/thread.model";
import User from "../src/lib/models/user.model";
import { connectToDb } from "../src/lib/mongoose";
import { getRedis, getSubscriber, userChannel } from "../src/lib/redis";
import { NotificationConsumer } from "../worker/consumer";
import { OutboxRelay } from "../worker/relay";

const RUN = randomUUID().slice(0, 8);
const tag = (name: string) => `__verify_${RUN}_${name}`;

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is not set");
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is not set");

  await connectToDb();
  const redis = await getRedis();

  const bus = new RedisStreamBus(redis, `verify-${RUN}`);
  await bus.ensureGroup();

  const relay = new OutboxRelay(bus, redis);
  const consumer = new NotificationConsumer(bus, redis);

  // Track pub/sub separately: the consumer publishes fire-and-forget, so the
  // only way to know it happened is to be listening.
  const subscriber = await getSubscriber();
  let published = 0;

  try {
    console.log(`\nSeeding fixtures (run ${RUN})\n`);

    const [author, liker, second] = await User.create([
      { id: tag("author"), username: tag("author"), name: "Author", onboarded: true },
      { id: tag("liker"), username: tag("liker"), name: "Liker", onboarded: true },
      { id: tag("second"), username: tag("second"), name: "Second", onboarded: true },
    ]);

    const thread = await Thread.create({
      text: `verification thread ${RUN}`,
      author: author._id,
      parentId: null,
    });

    await subscriber.subscribe(userChannel(String(author._id)), () => {
      published++;
    });

    // ---- 1. atomic emit -------------------------------------------------
    console.log("1. Domain write and event commit together");

    const eventId = await withTransaction((session) =>
      emit(session, "thread.liked", String(liker._id), {
        threadId: String(thread._id),
        threadAuthorId: String(author._id),
      })
    );

    const row = await Outbox.findOne({ eventId }).lean<{ published: boolean } | null>();
    check("outbox row committed", row !== null);
    check("outbox row starts unpublished", row?.published === false);

    // ---- 2. relay -------------------------------------------------------
    console.log("\n2. Relay moves it onto the stream");

    await relay.drainOnce();

    const afterRelay = await Outbox.findOne({ eventId }).lean<{
      published: boolean;
      publishedAt: Date | null;
    } | null>();
    check("outbox row marked published", afterRelay?.published === true);
    check("publishedAt stamped", afterRelay?.publishedAt != null);

    // ---- 3. consumer ----------------------------------------------------
    console.log("\n3. Consumer materialises the notification");

    const handled = await consumer.runOnce({ blockMs: 1_000 });
    check("consumer handled at least one entry", handled >= 1, `handled ${handled}`);

    const notification = await findNotification(author._id, thread._id);
    check("notification row created", notification !== null);
    check("one actor recorded", notification?.actors?.length === 1);
    check("starts unread", notification?.readAt == null);

    await settle();
    check("published to the recipient's channel", published >= 1, `saw ${published}`);

    // ---- 4. idempotency -------------------------------------------------
    console.log("\n4. Redelivering the same event changes nothing");

    const replay: DomainEvent = {
      eventId,
      type: "thread.liked",
      occurredAt: new Date(),
      actorId: String(liker._id),
      payload: {
        threadId: String(thread._id),
        threadAuthorId: String(author._id),
      },
    };
    await bus.publish([replay]);
    await consumer.runOnce({ blockMs: 1_000 });

    const afterReplay = await findNotification(author._id, thread._id);
    check("still exactly one actor", afterReplay?.actors?.length === 1, `got ${afterReplay?.actors?.length}`);

    const rowCount = await Notification.countDocuments({
      recipient: author._id,
      kind: "like",
      threadId: thread._id,
    });
    check("no duplicate notification row", rowCount === 1, `got ${rowCount}`);

    // ---- 5. collapsing --------------------------------------------------
    console.log("\n5. A second actor collapses into the same row");

    await bus.publish([
      {
        eventId: randomUUID(),
        type: "thread.liked",
        occurredAt: new Date(),
        actorId: String(second._id),
        payload: {
          threadId: String(thread._id),
          threadAuthorId: String(author._id),
        },
      },
    ]);
    await consumer.runOnce({ blockMs: 1_000 });

    const collapsed = await findNotification(author._id, thread._id);
    check("two actors on one row", collapsed?.actors?.length === 2, `got ${collapsed?.actors?.length}`);
    check(
      "newest actor is last",
      String(collapsed?.actors?.[1]) === String(second._id)
    );

    // ---- 6. read state --------------------------------------------------
    console.log("\n6. Read state survives redelivery but yields to new activity");

    await Notification.updateOne(
      { recipient: author._id, kind: "like", threadId: thread._id },
      { $set: { readAt: new Date() } }
    );

    // A redelivery of an actor already on the row must not resurface it.
    await bus.publish([replay]);
    await consumer.runOnce({ blockMs: 1_000 });

    const afterReadReplay = await findNotification(author._id, thread._id);
    check("redelivery leaves it read", afterReadReplay?.readAt != null);

    // A genuinely new actor must.
    const third = await User.create({
      id: tag("third"),
      username: tag("third"),
      name: "Third",
      onboarded: true,
    });

    await bus.publish([
      {
        eventId: randomUUID(),
        type: "thread.liked",
        occurredAt: new Date(),
        actorId: String(third._id),
        payload: {
          threadId: String(thread._id),
          threadAuthorId: String(author._id),
        },
      },
    ]);
    await consumer.runOnce({ blockMs: 1_000 });

    const afterNewActor = await findNotification(author._id, thread._id);
    check("new activity marks it unread again", afterNewActor?.readAt == null);
    check("three actors now", afterNewActor?.actors?.length === 3, `got ${afterNewActor?.actors?.length}`);

    // ---- 7. self-action -------------------------------------------------
    console.log("\n7. Liking your own thread notifies nobody");

    await bus.publish([
      {
        eventId: randomUUID(),
        type: "thread.liked",
        occurredAt: new Date(),
        actorId: String(author._id),
        payload: {
          threadId: String(thread._id),
          threadAuthorId: String(author._id),
        },
      },
    ]);
    await consumer.runOnce({ blockMs: 1_000 });

    const afterSelf = await findNotification(author._id, thread._id);
    check("author not added as an actor", afterSelf?.actors?.length === 3, `got ${afterSelf?.actors?.length}`);
  } finally {
    console.log("\nCleaning up fixtures");
    await Notification.deleteMany({}).where("recipient").in(await verifyUserIds());
    await Thread.deleteMany({ text: new RegExp(RUN) });
    await Outbox.deleteMany({ actorId: { $in: await verifyUserIds() } });
    await User.deleteMany({ id: new RegExp(`^__verify_${RUN}_`) });

    await subscriber.quit().catch(() => {});
    await redis.quit().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("Pipeline verified.\n");
}

async function findNotification(recipient: unknown, threadId: unknown) {
  return Notification.findOne({ recipient, kind: "like", threadId }).lean<{
    actors?: unknown[];
    readAt: Date | null;
  } | null>();
}

async function verifyUserIds(): Promise<unknown[]> {
  const users = await User.find({ id: new RegExp(`^__verify_${RUN}_`) })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  return users.map((u) => u._id);
}

/** Pub/sub delivery is asynchronous; give it a beat before asserting on it. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

main().catch((err) => {
  console.error("\nVerification aborted:", err);
  process.exit(1);
});
