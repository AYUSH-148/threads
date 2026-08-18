import { cn } from "@/lib/utils";

/** A single shimmering block. Compose these into route-level skeletons. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

/**
 * Mirrors the real ThreadCard's geometry closely enough that the swap to loaded
 * content does not shift the page — the point of a skeleton over a spinner.
 */
export function ThreadCardSkeleton() {
  return (
    <div className="surface-card p-6">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="w-0.5 flex-1 rounded-full" />
        </div>

        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[92%]" />
            <Skeleton className="h-3.5 w-[64%]" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-8 w-16 rounded-pill" />
            <Skeleton className="h-8 w-16 rounded-pill" />
            <Skeleton className="h-8 w-16 rounded-pill" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-[74px] rounded-pill" />
    </div>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="surface-card w-full p-5 sm:w-[340px]">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-8 w-16 rounded-pill" />
        <Skeleton className="h-7 w-20 rounded-pill" />
      </div>
    </div>
  );
}

export function ActivityCardSkeleton() {
  return (
    <div className="surface-card flex items-center gap-3 px-5 py-4">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-3.5 flex-1 max-w-[280px]" />
      <Skeleton className="ml-auto h-3 w-16" />
    </div>
  );
}

/** The page title placeholder every route-level skeleton opens with. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-44 rounded-xl" />
      <Skeleton className="h-3.5 w-64" />
    </div>
  );
}
