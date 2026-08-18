"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The thin gradient bar under the topbar during navigation.
 *
 * The App Router exposes no navigation-start event, and `loading.tsx` only
 * covers routes that suspend — a cached route swaps instantly with no feedback
 * at all, which on a slow connection reads as a dead click. So the start is
 * inferred from the click on the link and the end from the URL actually
 * changing.
 */
function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Modified clicks open a new tab; the current document never navigates.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      // Same URL, or a pure hash jump: no navigation to report.
      const current = window.location.pathname + window.location.search;
      if (destination.pathname + destination.search === current) return;

      setActive(true);

      // A navigation can fail or be cancelled, and nothing would then clear the
      // bar. This cap means the worst case is a bar that disappears on its own
      // rather than one that spins forever.
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setActive(false), 8000);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      clearTimeout(timeoutRef.current);
    };
  }, []);

  // The URL has changed, so the navigation this bar was reporting is done.
  useEffect(() => {
    setActive(false);
    clearTimeout(timeoutRef.current);
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-16 z-50 h-[2px] overflow-hidden transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      {active && (
        <div
          className="h-full w-full animate-progress-indeterminate rounded-full"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, hsl(var(--accent-violet)), hsl(var(--brand)), hsl(var(--accent-aqua)), transparent)",
          }}
        />
      )}
    </div>
  );
}

export default RouteProgressBar;
