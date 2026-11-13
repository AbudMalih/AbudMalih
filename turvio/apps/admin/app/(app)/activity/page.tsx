import { FormAlert, PageHeader, cn } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { loadPlatform } from "../../../lib/load";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const EVENT: Record<string, { label: string; cls: string }> = {
  "organizations:insert": { label: "Company created", cls: "bg-nx-violet-soft text-nx-violet-text" },
  "organizations:update": { label: "Company changed", cls: "bg-surface-2 text-muted" },
  "subscriptions:insert": { label: "Subscription started", cls: "bg-nx-mint-soft text-nx-mint" },
  "subscriptions:update": { label: "Subscription changed", cls: "bg-nx-cobalt-soft text-nx-cobalt-text" },
  "memberships:insert": { label: "Member joined", cls: "bg-nx-mint-soft text-nx-mint" },
  "memberships:update": { label: "Role changed", cls: "bg-nx-violet-soft text-nx-violet-text" },
  "invitations:insert": { label: "Invitation sent", cls: "bg-nx-cobalt-soft text-nx-cobalt-text" },
  "invitations:update": { label: "Invitation updated", cls: "bg-surface-2 text-muted" },
};

/** Audit log (prototype "Audit-Log"): who changed which company, subscription, membership or invitation. */
export default async function ActivityPage() {
  const p = await loadPlatform();
  if (!p.ok) {
    return (
      <>
        <PageHeader title="Audit log" />
        <FormAlert>The TURVIO service returned an error (HTTP {p.status}). Reload to try again.</FormAlert>
      </>
    );
  }
  const entries = [...p.audit].filter((a) => a.action !== "delete").sort((a, b) => b.at.localeCompare(a.at));
  const today = p.now.toDateString();
  return (
    <>
      <PageHeader title="Audit log" description="Changes to companies, subscriptions, memberships and invitations · newest first" />
      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-card">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">No audit entries yet.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 pb-2.5 text-start">Time</th>
                  <th className="px-3 pb-2.5 text-start">Event</th>
                  <th className="px-3 pb-2.5 text-start">Company</th>
                  <th className="px-3 pb-2.5 text-start">Changed fields</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((a) => {
                  const ev = EVENT[`${a.table}:${a.action}`] ?? { label: `${a.table} ${a.action}`, cls: "bg-surface-2 text-muted" };
                  const at = new Date(a.at);
                  const time = at.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <tr key={a.id} className="border-t border-line">
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2 tabular">{at.toDateString() === today ? time : `${at.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} ${time}`}</td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-lg px-[9px] text-xs font-bold", ev.cls)}>{ev.label}</span>
                      </td>
                      <td className="px-3 py-3 text-ink">{a.organizationName ?? "—"}</td>
                      <td className="px-3 py-3 text-muted">{a.changedColumns?.length ? a.changedColumns.join(", ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
