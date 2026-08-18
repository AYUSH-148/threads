import { HeaderSkeleton, ThreadCardSkeleton } from "@/components/ui/skeleton";

/**
 * Shown while the home feed's server components resolve. Route-level
 * loading.tsx files were absent entirely, so every navigation sat on the
 * previous page with no feedback until the new one was ready.
 */
export default function Loading() {
  return (
    <>
      <div className="mb-8">
        <HeaderSkeleton />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <ThreadCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}
