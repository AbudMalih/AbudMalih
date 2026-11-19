"use client";

import { Badge, Button, Card, EmptyState, Field, FormAlert, PageHeader, Skeleton, type BadgeTone } from "@turvio/web-ui/ds";
import { Loader2, ScrollText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import { useI18n } from "../lib/i18n/client";
import { AUDIT_TABLES, eventLabel, tableLabel, type OrgList, type PlatformAuditEntry, type PlatformAuditPage } from "../lib/remote";
import { selectCls } from "./CompanyDetail";

export const AUDIT_PAGE = 50;
const TONE: Record<PlatformAuditEntry["action"], BadgeTone> = { insert: "success", update: "info", delete: "danger" };
/** Tables the filter offers: company administration first, then the operational records whose changes are logged. */
const FILTER_TABLES = [...AUDIT_TABLES, "membership_depots", "depots", "vehicles", "drivers", "tours", "stops", "proofs"];

/** Audit log across companies: who changed what (never record contents), newest first, paged by id. */
export function AuditLog({ initialOrganizationId = null }: { initialOrganizationId?: string | null }) {
  const { t, fmt } = useI18n();
  const [table, setTable] = useState("");
  const [orgId, setOrgId] = useState(initialOrganizationId ?? "");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<PlatformAuditEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "more" | { error: string }>("loading");
  const seq = useRef(0);

  useEffect(() => {
    api<OrgList>("GET", "/v1/platform/organizations?limit=200")
      .then((r) => setCompanies(r.organizations.map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => undefined);
  }, []);

  const fetchPage = useCallback(
    async (before: number | null) => {
      const n = ++seq.current;
      setState(before ? "more" : "loading");
      const params = new URLSearchParams({ limit: String(AUDIT_PAGE) });
      if (before) params.set("before", String(before));
      if (table) params.set("table", table);
      if (orgId) params.set("organizationId", orgId);
      try {
        const page = await api<PlatformAuditPage>("GET", `/v1/platform/audit?${params}`);
        if (n !== seq.current) return;
        setEntries((cur) => (before ? [...cur, ...page.entries] : page.entries));
        setNext(page.nextBefore);
        setState("ready");
      } catch (e) {
        if (n === seq.current) setState({ error: errorText(e) });
      }
    },
    [table, orgId],
  );

  useEffect(() => {
    void fetchPage(null);
  }, [fetchPage]);

  const time = (iso: string) => fmt.date(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  // A company chosen by link may be missing from the first 200 names: keep it selectable.
  const options = orgId && !companies.some((c) => c.id === orgId) ? [{ id: orgId, name: entries.find((e) => e.organizationId === orgId)?.organizationName ?? t("audit.selectedCompany") }, ...companies] : companies;

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.description")} />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-3 border-b border-line px-5 py-3 sm:grid-cols-[minmax(0,220px)_minmax(0,280px)] g:px-4">
          <Field label={t("audit.filterTable")} htmlFor="audit-table">
            <select id="audit-table" className={selectCls} value={table} onChange={(e) => setTable(e.target.value)}>
              <option value="">{t("audit.allTables")}</option>
              {FILTER_TABLES.map((x) => (
                <option key={x} value={x}>
                  {tableLabel(x, t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("common.company")} htmlFor="audit-company">
            <select id="audit-company" className={selectCls} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">{t("audit.allCompanies")}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {typeof state === "object" && (
          <div className="flex flex-col items-start gap-3 p-4">
            <FormAlert>{state.error}</FormAlert>
            <Button variant="secondary" size="sm" onClick={() => void fetchPage(null)}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {state === "loading" && (
          <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label={t("common.loading")}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
            ))}
          </div>
        )}
        {(state === "ready" || state === "more") && entries.length === 0 && <EmptyState icon={<ScrollText />} title={t("audit.empty")} description={t("audit.emptyHint")} />}
        {(state === "ready" || state === "more") && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("audit.time")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("audit.event")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("audit.actor")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("common.company")}</th>
                  <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("audit.fields")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0 g:hover:bg-[var(--hover)]">
                    <td className="whitespace-nowrap px-5 py-2 tabular text-ink-2 g:px-4">
                      <time dateTime={a.at}>{time(a.at)}</time>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Badge tone={TONE[a.action] ?? "neutral"} dot>
                          {t(`audit.kind.${a.action}`)}
                        </Badge>
                        <span className="text-ink">{eventLabel(a.table, a.action, t)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-2">{a.actor ? (a.actor.email ?? t("audit.unknownUser")) : <span className="text-muted">{t("audit.system")}</span>}</td>
                    <td className="px-3 py-2">
                      {a.organizationId ? (
                        <Link href={`/companies/${a.organizationId}`} className="text-ink hover:underline">
                          {a.organizationName ?? t("common.unknownCompany")}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-muted g:px-4">{a.action === "update" && a.changedColumns.length ? a.changedColumns.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(state === "ready" || state === "more") && entries.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-2.5 text-[12.5px] text-muted g:px-4">
            <span className="tabular">{t("audit.shown", { count: entries.length })}</span>
            {next ? (
              <Button variant="secondary" size="sm" onClick={() => void fetchPage(next)} disabled={state === "more"}>
                {state === "more" && <Loader2 className="animate-spin" />} {t("audit.loadMore")}
              </Button>
            ) : (
              <span>{t("audit.end")}</span>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
