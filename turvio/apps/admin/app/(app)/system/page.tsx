import { PageHeader } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { SystemStatusView } from "../../../components/SystemStatusView";

export const metadata: Metadata = { title: "System status" };

/**
 * Live platform status. Replaces the former static readiness checklist, whose statements had become
 * outdated: every service state shown here is measured when the page is opened (GET /v1/platform/system).
 */
export default function SystemPage() {
  return (
    <>
      <PageHeader title="System status" description="Platform services measured live · configuration listed separately" />
      <SystemStatusView />
    </>
  );
}
