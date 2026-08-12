import type { Express } from "express";

import type { NotificationPage, NotificationRow } from "../../src/lib/notifications/types";
import { createApp } from "../app";
import type { ApiConfig } from "../config";
import { silentLogger } from "../logger";
import type {
  HealthPort,
  IdentityPort,
  NotificationsPort,
  ReadinessReport,
  SubscriberPort,
  Viewer,
} from "../ports";
import { SseRegistry } from "../sse";

/**
 * Test doubles for the four ports, and an app built out of them.
 *
 * The point of the interfaces in ports.ts: these tests drive the real middleware
 * chain — CORS, rate limiting, token extraction, validation, error mapping, in
 * the order production runs them — with no MongoDB, no Redis and no Clerk. Every
 * assertion below is about the HTTP layer, which is the part that was previously
 * impossible to test at all.
 */

export function testConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    nodeEnv: "test",
    isProduction: false,
    port: 0,
    mongodbUrl: "mongodb://test/threads",
    redisUrl: "redis://test",
    clerkSecretKey: "sk_test_harness",
    allowedOrigins: ["http://localhost:3000"],
    ...overrides,
  };
}

export const VIEWER: Viewer = { clerkId: "user_clerk_1", userId: "652f1a000000000000000001" };
export const OTHER_VIEWER: Viewer = { clerkId: "user_clerk_2", userId: "652f1a000000000000000002" };

/** Accepts only the tokens it was given. Everything else is an invalid token. */
export function fakeIdentity(
  tokens: Record<string, Viewer> = { "valid-token": VIEWER }
): IdentityPort {
  return {
    async authenticate(token) {
      return tokens[token] ?? null;
    },
  };
}

export interface FakeNotifications extends NotificationsPort {
  /** Every call, in order, so a test can assert *which* user id reached the query. */
  calls: Array<{ method: "list" | "countUnread" | "markAllRead"; userId: string; opts?: unknown }>;
  page: NotificationPage;
  unread: number;
  updated: number;
}

export function fakeNotifications(): FakeNotifications {
  const fake: FakeNotifications = {
    calls: [],
    page: { notifications: [], isNext: false },
    unread: 0,
    updated: 0,

    async list(userId, opts) {
      fake.calls.push({ method: "list", userId, opts });
      return fake.page;
    },
    async countUnread(userId) {
      fake.calls.push({ method: "countUnread", userId });
      return fake.unread;
    },
    async markAllRead(userId) {
      fake.calls.push({ method: "markAllRead", userId });
      return fake.updated;
    },
  };

  return fake;
}

export interface FakeSubscriber extends SubscriberPort {
  /** Channels currently subscribed, so a leaked connection is visible to a test. */
  active: Set<string>;
  /** Channels that were subscribed at some point, kept after teardown. */
  seen: string[];
  /** Pushes a message to every listener on a channel, as Redis pub/sub would. */
  emit(channel: string, message: string): void;
  /** Makes the next subscribe() fail, standing in for Redis being down. */
  failNext: boolean;
}

export function fakeSubscriber(): FakeSubscriber {
  const listeners = new Map<string, Set<(message: string) => void>>();

  const fake: FakeSubscriber = {
    active: new Set(),
    seen: [],
    failNext: false,

    async subscribe(channel, onMessage) {
      if (fake.failNext) {
        fake.failNext = false;
        throw new Error("redis unreachable");
      }

      const forChannel = listeners.get(channel) ?? new Set();
      forChannel.add(onMessage);
      listeners.set(channel, forChannel);
      fake.active.add(channel);
      fake.seen.push(channel);

      return async () => {
        forChannel.delete(onMessage);
        if (forChannel.size === 0) fake.active.delete(channel);
      };
    },

    emit(channel, message) {
      for (const listener of listeners.get(channel) ?? []) listener(message);
    },
  };

  return fake;
}

const HEALTHY: ReadinessReport = {
  mongo: { ok: true, latencyMs: 1 },
  redis: { ok: true, latencyMs: 1 },
};

export interface FakeHealth extends HealthPort {
  report: ReadinessReport;
}

export function fakeHealth(report: ReadinessReport = HEALTHY): FakeHealth {
  const fake: FakeHealth = {
    report,
    async readiness() {
      return fake.report;
    },
    async metrics() {
      return {
        outbox: { unpublished: 3, oldestUnpublishedAgeMs: 412 },
        stream: { length: 128, pending: 2, deadLettered: 0 },
      };
    },
  };

  return fake;
}

export interface Harness {
  app: Express;
  identity: IdentityPort;
  notifications: FakeNotifications;
  subscriber: FakeSubscriber;
  health: FakeHealth;
  registry: SseRegistry;
}

export function buildHarness(
  overrides: {
    config?: Partial<ApiConfig>;
    identity?: IdentityPort;
    tokens?: Record<string, Viewer>;
    health?: FakeHealth;
  } = {}
): Harness {
  const identity = overrides.identity ?? fakeIdentity(overrides.tokens);
  const notifications = fakeNotifications();
  const subscriber = fakeSubscriber();
  const health = overrides.health ?? fakeHealth();
  const registry = new SseRegistry();

  const app = createApp({
    config: testConfig(overrides.config),
    logger: silentLogger,
    identity,
    notifications,
    subscriber,
    health,
    registry,
  });

  return { app, identity, notifications, subscriber, health, registry };
}

/** A notification row, for tests that care about the response body's shape. */
export function sampleRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "652f1a00000000000000000a",
    kind: "like",
    threadId: "652f1a00000000000000000b",
    actors: [{ id: "user_clerk_3", name: "Ada", username: "ada", image: "/a.png" }],
    actorCount: 1,
    lastActorAt: "2026-08-12T10:00:00.000Z",
    unread: true,
    threadPreview: "a thread",
    ...overrides,
  };
}

/**
 * Polls until `predicate` holds.
 *
 * Needed for the stream tests: a client disconnect is observed by the server
 * asynchronously, so asserting the subscription was torn down immediately after
 * cancelling a read would be a race that usually passes.
 */
export async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 2_000, intervalMs = 10 } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
