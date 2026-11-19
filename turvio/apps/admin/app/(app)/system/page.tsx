import { PageHeader } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { SystemStatusView } from "../../../components/SystemStatusView";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("system.title") };
}

/**
 * Live platform status. Every service state shown here is measured when the page is opened
 * (GET /v1/platform/system).
 */
export default async function SystemPage() {
  const { t } = await serverT();
  return (
    <>
      <PageHeader title={t("system.title")} description={t("system.description")} />
      <SystemStatusView />
    </>
  );
}
