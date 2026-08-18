import { Skeleton, ThreadCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="surface-card overflow-hidden">
        <Skeleton className="h-24 w-full rounded-none sm:h-28" />
        <div className="flex items-end gap-4 px-5 pb-6 sm:px-7">
          <Skeleton className="-mt-11 h-20 w-20 rounded-full sm:-mt-12" />
          <div className="space-y-2 pb-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      </div>

      <Skeleton className="mt-6 h-[62px] w-full rounded-2xl" />

      <div className="mt-6 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <ThreadCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}
