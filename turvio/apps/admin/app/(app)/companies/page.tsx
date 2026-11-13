import { FormAlert, PageHeader } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { CompanyTable } from "../../../components/CompanyTable";
import { NewCompanyDialog } from "../../../components/NewCompanyDialog";
import { loadPlatform } from "../../../lib/load";

export const metadata: Metadata = { title: "Organizations" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const p = await loadPlatform();
  return (
    <>
      <PageHeader title="Organizations" description="Tenants on the platform · plan, subscription and driver seats" actions={<NewCompanyDialog />} />
      {p.ok ? <CompanyTable rows={p.rows} now={p.now.getTime()} /> : <FormAlert>The TURVIO service returned an error (HTTP {p.status}). Reload to try again.</FormAlert>}
    </>
  );
}
