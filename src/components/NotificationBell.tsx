"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getUnreadCount } from "@/lib/actions/notification.action";

/**
 * Live unread badge.
 *
 * The SSE messages deliberately carry no count — the worker would otherwise
 * have to run a countDocuments per recipient, which for one post in a large
 * community means thousands of queries. Instead a message means "something
 * changed" and this component asks for the number, so the cost is one query per
 * connected viewer.
 */
function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(() => {
    getUnreadCount()
      .then(setCount)
      .catch(() => {
        /* transient; the next event or focus re-syncs */
      });
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.onmessage = refresh;

    // Serverless caps function duration, so this connection will be cut
    // periodically no matter what. EventSource reconnects on its own; re-reading
    // the count on open is what closes the gap, since anything published while
    // the connection was down was never queued for us.
    source.onopen = refresh;

    // Left empty on purpose: EventSource handles its own backoff, and logging
    // every expected disconnect would only be noise.
    source.onerror = () => {};

    // A backgrounded tab can be throttled hard enough to miss messages entirely.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

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
