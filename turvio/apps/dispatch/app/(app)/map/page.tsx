import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { MapWorkspace } from "../../../components/MapWorkspace";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.map") };
}

export default function MapPage() {
  return <MapWorkspace />;
}
