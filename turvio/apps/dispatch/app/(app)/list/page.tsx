import { serverT } from "../../../lib/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ToursPage } from "../../../components/ToursPage";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverT();
  return { title: t("shell.title.tours") };
}

export default function ListPage() {
  return (
    <Suspense>
      <ToursPage />
    </Suspense>
  );
}
