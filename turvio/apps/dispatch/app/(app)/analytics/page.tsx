import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { AnalyticsView } from "../../../components/AnalyticsView";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.analytics") };
}

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
