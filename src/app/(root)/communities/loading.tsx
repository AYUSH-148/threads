import { CommunityCardSkeleton, HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="mb-8">
        <HeaderSkeleton />
      </div>
      <Skeleton className="h-[46px] w-full rounded-pill" />
      <div className="mt-8 flex flex-wrap justify-center gap-4 sm:justify-start">
        {Array.from({ length: 4 }).map((_, index) => (
          <CommunityCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}
