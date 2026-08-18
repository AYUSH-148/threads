import { ActivityCardSkeleton, HeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="mb-8">
        <HeaderSkeleton />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <ActivityCardSkeleton key={index} />
        ))}
      </div>
    </>
  );
}
