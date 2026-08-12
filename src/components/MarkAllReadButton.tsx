"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

/**
 * Explicit rather than marking everything read as a side effect of rendering
 * /activity: a Server Component cannot revalidate during render, and silently
 * clearing the badge on navigation means a notification glanced at in passing is
 * gone for good.
 *
 * The write goes to the API service. It used to be a Server Action that called
 * `revalidatePath`, which no longer applies now that the mutation happens outside
 * Next — `router.refresh()` is the client-side equivalent, re-rendering the
 * Server Component with the rows it now sees as read.
 */
function MarkAllReadButton() {
  const [isPending, setIsPending] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();

  const markRead = async () => {
    setIsPending(true);

    try {
      const token = await getToken();
      if (!token) return;

      // No body: the rows updated are the caller's, identified by the token. There
      // is deliberately no user id to pass, and so none to tamper with.
      await apiFetch("/api/notifications/read", { token, method: "POST" });
      router.refresh();
    } catch {
      // Nothing was cleared, and the button stays available to try again. An
      // error toast for a failed badge reset is more disruption than the failure.
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => void markRead()}
      className="text-small-regular shrink-0 text-primary-500 disabled:opacity-50"
    >
      {isPending ? "Marking…" : "Mark all as read"}
    </button>
  );
}

export default MarkAllReadButton;
