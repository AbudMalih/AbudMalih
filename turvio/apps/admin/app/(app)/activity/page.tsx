import type { Metadata } from "next";
import { AuditLog } from "../../../components/AuditLog";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("audit.title") };
}
export const dynamic = "force-dynamic";

/** Audit log across companies (GET /v1/platform/audit): actor, event, company; filters and "Load more". */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  const id = organizationId && /^[0-9a-f-]{36}$/i.test(organizationId) ? organizationId : null;
  return <AuditLog key={id ?? "all"} initialOrganizationId={id} />;
}
