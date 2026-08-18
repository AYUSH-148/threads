import { Skeleton, ThreadCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <ThreadCardSkeleton />
      <Skeleton className="mt-8 h-[76px] w-full rounded-card" />
      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <ThreadCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}
