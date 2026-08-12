import { Router } from "express";

import type { HealthPort } from "../ports";
import type { SseRegistry } from "../sse";

/**
 * Liveness, readiness and pipeline depth.
 *
 * Unauthenticated on purpose — a platform health check has no session — which is
 * why nothing here reveals anything about a user. The counts are aggregate depth
 * and lag, the kind of thing that goes on a dashboard.
 */
export function healthRouter(deps: { health: HealthPort; registry: SseRegistry }): Router {
  const router = Router();

  /**
   * Liveness: is this process running.
   *
   * Deliberately touches no dependency. A liveness probe that checks MongoDB
   * makes the platform restart every replica during a database blip — which
   * removes the only thing still capable of serving cached reads and turns a
   * degraded system into an outage.
   */
  router.get("/healthz", (_req, res) => {
    res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });

  /**
   * Readiness: should this process receive traffic.
   *
   * This is where dependencies belong. A 503 takes the instance out of the load
   * balancer without killing it, so it can rejoin when Redis comes back.
   */
  router.get("/readyz", async (_req, res) => {
    const report = await deps.health.readiness();
    const ready = report.mongo.ok && report.redis.ok;

    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", ...report });
  });

  /**
   * Pipeline depth and lag.
   *
   * The pipeline had no observability before this: whether the relay was keeping
   * up, whether entries were stuck unacknowledged, and whether anything had been
   * dead-lettered were questions that could only be answered from a Redis shell.
   *
   * JSON rather than Prometheus text format, which is the obvious next step if
   * anything ever scrapes it. The numbers are the same either way; only the
   * serialisation would change.
   */
  router.get("/metrics", async (_req, res) => {
    const metrics = await deps.health.metrics();
    res.json({ ...metrics, sse: { connections: deps.registry.size } });
  });

  return router;
}
