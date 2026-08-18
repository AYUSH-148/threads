import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="mb-8">
        <HeaderSkeleton />
      </div>
      <div className="surface-card flex flex-col gap-6 p-6">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="ml-auto h-11 w-36 rounded-pill" />
      </div>
    </>
  );
}
