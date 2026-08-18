"use client";

import { useAuth } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch, apiUrl } from "@/lib/api/client";

/** First reconnect delay. Doubles per consecutive failure. */
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/**
 * Live unread badge, fed by the API service's SSE stream.
 *
 * The stream messages deliberately carry no count — the worker would otherwise
 * have to run a countDocuments per recipient, which for one post in a large
 * community means thousands of queries. A message means "something changed" and
 * this component asks for the number, so the cost is one query per *connected*
 * viewer.
 */
function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  // Bumped only when the count goes up, so re-reads that return the same
  // number — or a drop after "mark all read" — do not replay the animation.
  const [pulseKey, setPulseKey] = useState(0);
  const previousCount = useRef(initialCount);
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const { count: fresh } = await apiFetch<{ count: number }>(
        "/api/notifications/unread-count",
        { token }
      );
      if (fresh > previousCount.current) setPulseKey((key) => key + 1);
      previousCount.current = fresh;
      setCount(fresh);
    } catch {
      // Transient by nature — a dropped request, a token refreshing mid-flight.
      // The next event, reconnect or tab focus re-syncs, and a stale badge is not
      // worth an error surface.
    }
  }, [getToken]);

  useEffect(() => {
    // Clerk resolves the session asynchronously. Connecting before it does would
    // send an empty token and earn a 401 on the first attempt every page load.
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    /**
     * Reconnection is handled here rather than left to `EventSource`.
     *
     * `EventSource` cannot set headers, so the stream authenticates with the
     * token in the query string — and its built-in reconnect replays the original
     * URL. A Clerk session token lives about a minute, so the native retry would
     * spend the rest of the session re-presenting an expired token and collecting
     * 401s. Reconnecting by hand is what makes a fresh token possible.
     */
    const connect = async () => {
      if (cancelled) return;

      const token = await getToken();
      if (!token || cancelled) return;

      const next = new EventSource(
        apiUrl(`/api/stream?token=${encodeURIComponent(token)}`)
      );
      source = next;

      next.onopen = () => {
        failures = 0;
        // Anything published while the connection was down was never queued for
        // us, so the count is re-read on every successful connect. This is also
        // what makes a deploy that drops every stream harmless.
        void refresh();
      };

      next.onmessage = () => void refresh();

      next.onerror = () => {
        next.close();
        if (source === next) source = null;
        if (cancelled) return;

        // Jittered, not just exponential: the server closes every stream at once
        // when it shuts down, so a fixed delay would bring all of them back in
        // the same instant — the reconnect storm being exactly what the new
        // instance is least able to absorb.
        const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** failures++);
        retryTimer = setTimeout(() => void connect(), ceiling * (0.5 + Math.random() / 2));
      };
    };

    void connect();

    // A backgrounded tab can be throttled hard enough to miss messages entirely.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [getToken, isLoaded, isSignedIn, refresh]);

  return (
    <Link
      href="/activity"
      className="icon-btn relative"
      aria-label={count > 0 ? `Activity, ${count} unread` : "Activity"}
    >
      {/* Keyed on the count so a new arrival remounts the bell and replays the
          swing, rather than silently incrementing a number nobody notices. */}
      <Bell
        key={pulseKey}
        className={`h-[18px] w-[18px] ${pulseKey > 0 ? "animate-heart-pop" : ""}`}
        strokeWidth={2}
      />

      {count > 0 && (
        <span
          className="absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] animate-scale-in items-center
                     justify-center rounded-pill px-1 text-[10px] font-bold leading-none text-fg-onbrand shadow-count-badge"
          style={{
            backgroundImage:
              "linear-gradient(135deg, hsl(var(--accent-violet)), hsl(var(--brand)))",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;
