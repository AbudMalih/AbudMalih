"use client";

import { findPlan } from "@turvio/shared";
import { Avatar, Badge, Button, Card, EmptyState, FormAlert, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, PageHeader, SearchInput, Skeleton, cn, toast } from "@turvio/web-ui/ds";
import { Check, ChevronLeft, ChevronRight, Copy, Ellipsis, Eye, ListFilter, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "../lib/api";
import type { StatusFilter } from "../lib/companyTable";
import { useI18n } from "../lib/i18n/client";
import type { OrgList, OrgListItem, OrgStatus } from "../lib/remote";
import { ORG_STATUSES, STATUS } from "../lib/status";
import { When } from "./When";
import { NewCompanyDialog } from "./NewCompanyDialog";

export const PAGE_SIZE = 25;

/** Status shown for a company in lists: suspension wins, then the subscription's state, else the company's. */
export function listStatus(o: Pick<OrgListItem, "status" | "subscription">): StatusFilter {
  if (o.status === "suspended") return "suspended";
  if (o.subscription) return o.subscription.status;
  return o.status === "past_due" ? "past_due" : o.status === "cancelled" ? "cancelled" : o.status === "trialing" ? "trialing" : "active";
}

export async function copyText(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error(failed);
  }
}

function StatusMenu({ value, onChange }: { value: OrgStatus | null; onChange: (v: OrgStatus | null) => void }) {
  const { t } = useI18n();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="md" className={cn(value && "g:border-line-3 g:bg-[var(--selected)] g:text-ink")}>
          <ListFilter />
          {value ? t(`common.status.${value}`) : t("companies.allStatuses")}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-52">
        <MenuLabel>{t("common.status")}</MenuLabel>
        <MenuItem onSelect={() => onChange(null)} icon={value === null ? <Check /> : <span className="size-4" />}>
          {t("companies.allStatuses")}
        </MenuItem>
        <MenuSeparator />
        {ORG_STATUSES.map((s) => (
          <MenuItem key={s} onSelect={() => onChange(s)} icon={value === s ? <Check /> : <span className="size-4" />}>
            {t(`common.status.${s}`)}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: OrgList };

/** All companies on the platform (also those without a subscription): search, status filter and paging on the server. */
export function CompanyTable() {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrgStatus | null>(null);
  const [page, setPage] = useState(0);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const seq = useRef(0);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const next = search.trim();
    if (next === q) return;
    const id = setTimeout(() => {
      setQ(next);
      setPage(0);
    }, 250);
    return () => clearTimeout(id);
  }, [search, q]);

  const fetchPage = useCallback(async () => {
    const n = ++seq.current;
    setLoad((l) => (l.state === "ready" ? l : { state: "loading" }));
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    try {
      const data = await api<OrgList>("GET", `/v1/platform/organizations?${params}`);
      if (n === seq.current) setLoad({ state: "ready", data });
    } catch (e) {
      if (n === seq.current) setLoad({ state: "error", message: errorText(e) });
    }
  }, [q, status, page]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const data = load.state === "ready" ? load.data : null;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const filtered = q !== "" || status !== null;

  return (
    <>
      <PageHeader title={t("companies.title")} description={t("companies.description")} actions={<NewCompanyDialog onCreated={(id) => router.push(`/companies/${id}`)} />} />
      <Card className="overflow-hidden rounded-[22px]">
        <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between g:py-2.5 sm:g:px-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink g:text-[13.5px] g:font-semibold g:tracking-normal">{t("companies.listTitle")}</h2>
            {data && <span className="text-[13px] font-semibold text-muted tabular g:font-normal">{total}</span>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder={t("companies.searchPlaceholder")} label={t("companies.search")} className="sm:w-64" />
            <StatusMenu
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
            />
          </div>
        </div>

        {load.state === "error" && (
          <div className="flex flex-col items-start gap-3 px-4 pb-4 sm:px-5 g:px-4">
            <FormAlert>{load.message}</FormAlert>
            <Button variant="secondary" size="sm" onClick={() => void fetchPage()}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {load.state === "loading" && (
          <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5 g:px-4" aria-busy="true" aria-label={t("common.loading")}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        )}
        {data && data.organizations.length === 0 && (
          <EmptyState
            icon={<SearchX />}
            title={filtered ? t("companies.noMatches") : t("companies.none")}
            description={filtered ? t("companies.noMatchesHint") : t("companies.noneHint")}
            action={
              filtered && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setQ("");
                    setStatus(null);
                    setPage(0);
                  }}
                >
                  {t("companies.clearFilters")}
                </Button>
              )
            }
          />
        )}
        {data && data.organizations.length > 0 && (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px] g:text-[13px]">
              <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted g:text-[12px] g:font-medium g:normal-case g:tracking-normal">
                <tr className="border-b border-line">
                  <th scope="col" className="h-10 ps-4 pe-3 text-start sm:ps-5 g:h-9">{t("common.company")}</th>
                  <th scope="col" className="h-10 px-3 text-start g:h-9">{t("common.plan")}</th>
                  <th scope="col" className="h-10 px-3 text-start g:h-9">{t("common.status")}</th>
                  <th scope="col" className="hidden h-10 px-3 text-end md:table-cell g:h-9">{t("companies.members")}</th>
                  <th scope="col" className="hidden h-10 px-3 text-end md:table-cell g:h-9">{t("companies.drivers")}</th>
                  <th scope="col" className="hidden h-10 px-3 text-start lg:table-cell g:h-9">{t("common.created")}</th>
                  <th scope="col" className="h-10 w-12 pe-4 sm:pe-5">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.organizations.map((o) => {
                  const st = listStatus(o);
                  return (
                    <tr key={o.id} className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2 g:hover:bg-[var(--hover)]">
                      <td className="py-3 ps-4 pe-3 sm:ps-5 g:py-2">
                        <Link href={`/companies/${o.id}`} className="flex items-center gap-3 rounded text-start outline-none focus-visible:shadow-[var(--shadow-focus)]">
                          <Avatar name={o.name} square className="g:size-6 g:text-[10px]" />
                          <span className="min-w-0">
                            <span className="block max-w-[280px] truncate font-bold text-ink g:font-medium">{o.name}</span>
                            <span className="block text-xs text-muted">
                              {o.slug} · {o.countryCode}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 g:py-2">
                        {o.subscription ? (
                          <>
                            <span className="font-medium text-ink-2">{findPlan(o.subscription.planCode)?.name ?? o.subscription.planCode}</span>
                            <span className="block text-xs text-muted tabular">{t("companies.seats", { count: o.subscription.seats })}</span>
                          </>
                        ) : (
                          <span className="text-muted">{t("common.noPlan")}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 g:py-2">
                        <Badge tone={STATUS[st].tone} dot>
                          {t(`common.status.${st}`)}
                        </Badge>
                      </td>
                      <td className="hidden px-3 py-3 text-end tabular text-ink-2 md:table-cell g:py-2">{o.members}</td>
                      <td className="hidden px-3 py-3 text-end tabular text-ink-2 md:table-cell g:py-2">{o.activeDrivers}</td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-ink-2 lg:table-cell g:py-2">
                        <When iso={o.createdAt} />
                      </td>
                      <td className="pe-4 text-end sm:pe-5">
                        <Menu>
                          <MenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={t("companies.actionsFor", { name: o.name })} className="text-subtle opacity-70 group-hover:opacity-100 data-[state=open]:opacity-100">
                              <Ellipsis />
                            </Button>
                          </MenuTrigger>
                          <MenuContent className="w-56">
                            <MenuItem icon={<Eye />} onSelect={() => router.push(`/companies/${o.id}`)}>
                              {t("companies.open")}
                            </MenuItem>
                            <MenuItem icon={<Copy />} onSelect={() => void copyText(o.id, t("companies.idCopied"), t("common.clipboardFailed"))}>
                              {t("companies.copyId")}
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted sm:px-5 g:py-2">
            <span className="tabular">{t("companies.range", { from, to, total })}</span>
            <div className="flex items-center gap-1.5">
              <span className="me-2 hidden tabular sm:inline">{t("companies.page", { page: page + 1, pages: pageCount })}</span>
              <Button variant="secondary" size="icon-sm" aria-label={t("companies.previous")} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="rtl:rotate-180" />
              </Button>
              <Button variant="secondary" size="icon-sm" aria-label={t("companies.next")} disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
