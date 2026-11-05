import { Card, Skeleton } from "@turvio/web-ui/ds";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="size-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}
