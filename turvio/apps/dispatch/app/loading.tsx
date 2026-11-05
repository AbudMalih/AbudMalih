import { Skeleton } from "@turvio/web-ui/ds";

export default function Loading() {
  return (
    <div className="flex h-full gap-0" aria-busy="true" aria-label="Loading">
      <div className="hidden w-[340px] flex-col gap-2 border-e border-line p-3 lg:flex">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="m-0 flex-1 rounded-none" />
    </div>
  );
}
