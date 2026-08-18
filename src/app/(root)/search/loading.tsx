import { HeaderSkeleton, Skeleton, UserCardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="mb-8">
        <HeaderSkeleton />
      </div>
      <Skeleton className="h-[46px] w-full rounded-pill" />
      <div className="surface-card mt-8 flex flex-col gap-1 p-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <UserCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}
