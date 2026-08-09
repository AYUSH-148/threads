"use client";

import { useTransition } from "react";

import { markAllNotificationsRead } from "@/lib/actions/notification.action";

/**
 * Explicit rather than marking everything read as a side effect of rendering
 * /activity: a Server Component cannot revalidate during render, and silently
 * clearing the badge on navigation means a notification glanced at in passing is
 * gone for good.
 */
function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => void markAllNotificationsRead())}
      className="text-small-regular shrink-0 text-primary-500 disabled:opacity-50"
    >
      {isPending ? "Marking…" : "Mark all as read"}
    </button>
  );
}

export default MarkAllReadButton;
