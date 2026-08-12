"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const { count: fresh } = await apiFetch<{ count: number }>(
        "/api/notifications/unread-count",
        { token }
      );
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
      className="relative flex cursor-pointer items-center p-2"
      aria-label={count > 0 ? `Activity, ${count} unread` : "Activity"}
    >
      <Image src="/assets/heart-gray.svg" alt="" width={24} height={24} />

      {count > 0 && (
        <span
          className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center
                     justify-center rounded-full bg-primary-500 px-1
                     text-[10px] font-semibold leading-none text-light-1"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;
