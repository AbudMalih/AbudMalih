import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { PickupsView } from "../../../components/PickupsView";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.pickups") };
}

export default function PickupsPage() {
  return <PickupsView />;
}
