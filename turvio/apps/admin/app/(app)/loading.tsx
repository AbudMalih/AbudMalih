import { Skeleton } from "@turvio/web-ui/ds";
import { serverT } from "../../lib/i18n/server";

/** Content-area skeleton: the shell (sidebar, top bar) stays visible while a page loads. */
export default async function Loading() {
  const { t } = await serverT();
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label={t("common.loading")}>
      <div>
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-12">
        <Skeleton className="h-[300px] rounded-[26px] xl:col-span-8 g:rounded-lg" />
        <Skeleton className="h-[300px] rounded-[22px] xl:col-span-4 g:rounded-lg" />
      </div>
    </div>
  );
}
