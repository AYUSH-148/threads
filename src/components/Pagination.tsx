"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "./ui/spinner";

interface PaginationProps {
  pageNumber: number;
  isNext: boolean;
  path: string;
}

function Pagination({ pageNumber, isNext, path }: PaginationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const go = (type: "prev" | "next") => {
    const next = type === "prev" ? Math.max(1, pageNumber - 1) : pageNumber + 1;
    if (next === pageNumber) return;

    // The home feed passes path="/" while every other caller passes a bare
    // segment. Normalising both here avoids the `//?page=2` the old template
    // produced for the feed.
    const base = `/${path}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    const href = next > 1 ? `${base}?page=${next}` : base;

    startTransition(() => {
      router.push(href);
      // Paging without this leaves the viewer at the scroll offset they were
      // at, which on page 2 is the middle of a fresh list.
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (!isNext && pageNumber === 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => go("prev")}
        disabled={pageNumber === 1 || isPending}
        className="btn-soft px-4 py-2"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
        <span className="max-xs:hidden">Previous</span>
      </button>

      <span className="flex h-9 min-w-[2.5rem] items-center justify-center rounded-pill border border-hairline bg-surface-2 px-3 text-small-semibold tabular-nums text-fg">
        {isPending ? <Spinner className="h-3.5 w-3.5 text-brand" /> : pageNumber}
      </span>

      <button
        type="button"
        onClick={() => go("next")}
        disabled={!isNext || isPending}
        className="btn-soft px-4 py-2"
      >
        <span className="max-xs:hidden">Next</span>
        <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </nav>
  );
}

export default Pagination;
