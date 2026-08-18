"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

/**
 * Route-level error boundary. Without one, a throw in any server component
 * fell through to Next's default full-page error screen, which is unstyled and
 * offers the viewer nothing but a reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex animate-fade-up flex-col items-center rounded-card border border-danger/25 bg-danger/5 px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <TriangleAlert className="h-6 w-6" strokeWidth={1.9} />
      </span>

      <h2 className="font-display text-heading4-medium text-fg">
        Something went wrong
      </h2>
      <p className="mt-1.5 max-w-sm text-small-regular text-fg-subtle">
        This page could not be loaded. Trying again often clears it.
      </p>

      {/* The digest is the only handle on the server-side stack, which is not
          sent to the browser — worth surfacing so a report can be traced. */}
      {error.digest && (
        <code className="mt-3 rounded-pill bg-surface-2 px-3 py-1 text-tiny-medium text-fg-subtle">
          {error.digest}
        </code>
      )}

      <button type="button" onClick={reset} className="btn-brand mt-6 px-5 py-2.5">
        <RotateCw className="h-4 w-4" strokeWidth={2.2} />
        Try again
      </button>
    </div>
  );
}
