import cors from "cors";
import express, { type Express } from "express";

import type { ApiConfig } from "./config";
import type { Logger } from "./logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { coarseRateLimit } from "./middleware/rate-limit";
import { requestContext } from "./middleware/request-context";
import type { HealthPort, IdentityPort, NotificationsPort, SubscriberPort } from "./ports";
import { healthRouter } from "./routes/health";
import { notificationsRouter } from "./routes/notifications";
import { streamRouter } from "./routes/stream";
import { SseRegistry } from "./sse";

export interface AppDeps {
  config: ApiConfig;
  logger: Logger;
  identity: IdentityPort;
  notifications: NotificationsPort;
  subscriber: SubscriberPort;
  health: HealthPort;
  registry: SseRegistry;
}

/**
 * Builds the app without starting it.
 *
 * Separated from `index.ts` so the tests can exercise the real middleware chain
 * — CORS, rate limiting, authentication, validation, error mapping, all of it in
 * the order it actually runs — against fake dependencies, with no listening
 * socket, no MongoDB and no Redis. An app that calls `listen()` in the same
 * module that defines its routes can only be tested by starting it.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();

  // Advertising the framework and version to every caller is free
  // reconnaissance for anyone matching against a CVE list.
  app.disable("x-powered-by");

  if (deps.config.isProduction) {
    // Exactly one hop — the platform's load balancer. `true` would trust an
    // X-Forwarded-For from anyone, which lets a caller spoof its own IP and walk
    // straight through the IP-keyed rate limiter.
    app.set("trust proxy", 1);
  }

  app.use(requestContext(deps.logger));

  // Mounted before the rate limiter: a platform probing readiness every few
  // seconds must never be throttled, and least of all during the incident that
  // made the probes interesting.
  app.use(healthRouter({ health: deps.health, registry: deps.registry }));

  app.use(
    cors({
      origin: deps.config.allowedOrigins,
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
      // So the browser can read the correlation id off a failed response and a
      // bug report can quote it.
      exposedHeaders: ["X-Request-Id"],
      // Credentials are bearer tokens in a header, never cookies. A browser will
      // not attach a header to a cross-site request on its own, so there is no
      // CSRF surface here to defend — which is the main reason for preferring the
      // token over the session cookie.
      credentials: false,
      maxAge: 86_400,
    })
  );

  app.use(coarseRateLimit());

  // Only /read posts, and it has no body. The cap is here so that changing that
  // does not silently accept a megabyte of JSON.
  app.use(express.json({ limit: "16kb" }));

  app.use(
    "/api/notifications",
    notificationsRouter({ identity: deps.identity, notifications: deps.notifications })
  );

  app.use(
    "/api/stream",
    streamRouter({
      identity: deps.identity,
      subscriber: deps.subscriber,
      registry: deps.registry,
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler({ isProduction: deps.config.isProduction }));

  return app;
}
