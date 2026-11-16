import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { PlanningView } from "../../../components/PlanningView";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.planning") };
}

export default function PlanningPage() {
  return <PlanningView />;
}
