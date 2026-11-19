import type { Metadata } from "next";
import { CompanyTable } from "../../../components/CompanyTable";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("companies.title") };
}
export const dynamic = "force-dynamic";

export default function CompaniesPage() {
  return <CompanyTable />;
}
