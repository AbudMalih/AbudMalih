import type { Metadata } from "next";
import { CompanyDetail } from "../../../../components/CompanyDetail";
import { serverT } from "../../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("company.title") };
}
export const dynamic = "force-dynamic";

/** One company (loaded in the browser through the API proxy, so every action can refresh it in place). */
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyDetail id={id} />;
}
