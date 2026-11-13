import { Skeleton } from "@turvio/web-ui/ds";

/** Content-area skeleton: the shell (sidebar, top bar) stays visible while a page loads. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div>
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12">
        <Skeleton className="h-[300px] rounded-[26px] xl:col-span-8" />
        <Skeleton className="h-[300px] rounded-[22px] xl:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-[18px] xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[150px] rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
