import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { FleetView } from "../../../components/FleetView";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.fleet") };
}

export default function FleetPage() {
  return <FleetView />;
}
