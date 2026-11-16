import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "../../../components/SettingsView";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.settings") };
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
