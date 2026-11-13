"use client";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  SearchInput,
  Sheet,
  cn,
  toast,
  type BadgeTone,
} from "@turvio/web-ui/ds";
import { ArrowDown, ArrowUp, ArrowUpDown, Ban, ChevronLeft, ChevronRight, Copy, CreditCard, Download, Ellipsis, Eye, ListFilter, SearchX, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DEFAULT_QUERY, applyQuery, displayStatus, toCsv, type SortKey, type StatusFilter, type TableQuery } from "../lib/companyTable";
import type { TenantRow } from "../lib/platform";

export const STATUS_META: Record<StatusFilter, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trial", tone: "brand" },
  past_due: { label: "Past due", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  incomplete: { label: "Incomplete", tone: "warning" },
  suspended: { label: "Suspended", tone: "danger" },
};

const PLAN_OPTIONS = [
  { code: "driver_solo", label: "Driver Solo" },
  { code: "team", label: "Team" },
  { code: "business", label: "Business" },
];

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

function daysUntil(iso: string, now: number) {
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Clipboard not available in this browser");
  }
}

function SortHeader({ label, k, query, onSort, className }: { label: string; k: SortKey; query: TableQuery; onSort: (k: SortKey) => void; className?: string }) {
  const active = query.sort === k;
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("h-11 px-3 text-start font-bold", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 uppercase transition-colors hover:bg-surface-2 hover:text-ink", active && "text-ink")}
      >
        {label}
        <Icon className={cn("size-3", active ? "text-nx-violet-text" : "text-muted")} aria-hidden="true" />
      </button>
    </th>
  );
}

function FilterMenu({ label, options, selected, onChange }: { label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="md" className={cn(selected.length > 0 && "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50")}>
          <ListFilter />
          {label}
          {selected.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-2xs font-semibold leading-4 text-white tabular">{selected.length}</span>}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-52">
        <MenuLabel>{label}</MenuLabel>
        {options.map((o) => (
          <MenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onCheckedChange={(c) => onChange(c ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
          >
            {o.label}
          </MenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => onChange([])}>Clear filter</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink">{children}</dd>
    </div>
  );
}

export function CompanyTable({ rows, now }: { rows: TenantRow[]; now: number }) {
  const [query, setQuery] = useState<TableQuery>(DEFAULT_QUERY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<TenantRow | null>(null);
  const result = useMemo(() => applyQuery(rows, query), [rows, query]);

  const update = (patch: Partial<TableQuery>) => setQuery((q) => ({ ...q, page: 0, ...patch }));
  const onSort = (k: SortKey) => setQuery((q) => ({ ...q, sort: k, dir: q.sort === k && q.dir === "asc" ? "desc" : "asc" }));
  const filtersActive = query.search !== "" || query.statuses.length > 0 || query.plans.length > 0;

  const pageIds = result.rows.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const headerChecked = pageSelected === 0 ? false : pageSelected === pageIds.length ? true : "indeterminate";
  const toggleAll = (on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const exportCsv = (list: TenantRow[]) => {
    const blob = new Blob([toCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turvio-companies-${new Date(now).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} ${list.length === 1 ? "company" : "companies"}`);
  };

  const from = result.total === 0 ? 0 : result.page * query.pageSize + 1;
  const to = Math.min(result.total, (result.page + 1) * query.pageSize);

  return (
    <Card className="overflow-hidden rounded-[22px]" id="companies">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">Companies</h2>
          <span className="text-[13px] font-semibold text-muted tabular">{rows.length}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={query.search} onChange={(v) => update({ search: v })} placeholder="Search companies…" label="Search companies" className="sm:w-64" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenu
              label="Status"
              options={(Object.keys(STATUS_META) as StatusFilter[]).filter((s) => s !== "incomplete").map((s) => ({ value: s, label: STATUS_META[s].label }))}
              selected={query.statuses}
              onChange={(v) => update({ statuses: v as StatusFilter[] })}
            />
            <FilterMenu label="Plan" options={PLAN_OPTIONS.map((p) => ({ value: p.code, label: p.label }))} selected={query.plans} onChange={(v) => update({ plans: v })} />
            <Button variant="secondary" onClick={() => exportCsv(result.all)} disabled={result.total === 0}>
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/70 px-4 py-2 text-[13px] sm:px-5" role="status">
          <span className="font-medium text-brand-700 tabular">{selected.size} selected</span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => exportCsv(rows.filter((r) => selected.has(r.id)))}>
              <Download /> Export selected
            </Button>
            <Button size="sm" variant="secondary" onClick={() => copy([...selected].join("\n"), "Company IDs")}>
              <Copy /> Copy IDs
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X />
            </Button>
          </div>
        </div>
      )}

      {result.total === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No companies match your filters"
          description="Try a different search term or remove some filters."
          action={
            filtersActive && (
              <Button variant="secondary" onClick={() => setQuery(DEFAULT_QUERY)}>
                Clear all filters
              </Button>
            )
          }
        />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="h-10 w-10 ps-4 sm:ps-5">
                  <Checkbox checked={headerChecked} onCheckedChange={toggleAll} label="Select all companies on this page" />
                </th>
                <SortHeader label="Company" k="name" query={query} onSort={onSort} />
                <SortHeader label="Plan" k="plan" query={query} onSort={onSort} />
                <th scope="col" className="h-11 px-3 text-start font-bold">Status</th>
                <SortHeader label="Drivers" k="drivers" query={query} onSort={onSort} className="hidden md:table-cell" />
                <th scope="col" className="hidden h-11 px-3 text-start font-bold xl:table-cell">Billing</th>
                <SortHeader label="Renewal" k="renewsAt" query={query} onSort={onSort} className="hidden lg:table-cell" />
                <th scope="col" className="h-10 w-12 pe-4 sm:pe-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const st = STATUS_META[displayStatus(r)];
                const left = daysUntil(r.renewsAt, now);
                const isSel = selected.has(r.id);
                const usage = r.driverLimit ? Math.min(1, r.activeDrivers / r.driverLimit) : null;
                return (
                  <tr
                    key={r.id}
                    data-state={isSel ? "selected" : undefined}
                    className="group border-b border-line transition-colors last:border-0 hover:bg-surface-2 data-[state=selected]:bg-brand-50"
                  >
                    <td className="ps-4 sm:ps-5">
                      <Checkbox checked={isSel} onCheckedChange={(v) => toggle(r.id, v)} label={`Select ${r.name}`} />
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => setDetail(r)} className="flex items-center gap-3 rounded text-start outline-none focus-visible:shadow-[var(--shadow-focus)]">
                        <Avatar name={r.name} square />
                        <span className="min-w-0">
                          <span className="block max-w-[280px] truncate font-bold text-ink group-hover:text-brand-700">{r.name}</span>
                          <span className="block text-xs text-muted">
                            {r.slug} · {r.countryCode}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="font-medium text-ink-2">{r.planName}</span>
                      <span className="block text-xs text-muted">{r.audience === "individual_driver" ? "Individual" : "Company"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 md:table-cell">
                      <div className="tabular font-medium text-ink-2">
                        {r.activeDrivers}
                        <span className="font-normal text-subtle"> / {r.driverLimit ?? "∞"}</span>
                      </div>
                      {usage !== null && (
                        <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                          <div className={cn("h-full rounded-full", usage >= 1 ? "bg-warning" : "bg-brand-500")} style={{ width: `${usage * 100}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 xl:table-cell">
                      <span className="text-ink-2">{r.interval === "month" ? "Monthly" : "Annual"}</span>
                      <span className="block text-xs text-muted tabular">
                        {r.seats} {r.seats === 1 ? "seat" : "seats"}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 lg:table-cell">
                      <span className="text-ink-2 tabular">{fmtDate(r.renewsAt)}</span>
                      <span className={cn("block text-xs", r.renewalKind === "trial_end" && left <= 3 ? "text-warning-ink" : "text-muted")}>
                        {r.renewalKind === "trial_end" ? (left < 0 ? "Trial expired" : `Trial · ${left}d left`) : r.renewalKind === "ends" ? "Ends" : "Renews"}
                      </span>
                    </td>
                    <td className="pe-4 text-end sm:pe-5">
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`} className="text-subtle opacity-70 group-hover:opacity-100 data-[state=open]:bg-surface-2 data-[state=open]:opacity-100">
                            <Ellipsis />
                          </Button>
                        </MenuTrigger>
                        <MenuContent className="w-64">
                          <MenuItem icon={<Eye />} onSelect={() => setDetail(r)}>
                            View details
                          </MenuItem>
                          <MenuItem icon={<Copy />} onSelect={() => copy(r.id, "Company ID")}>
                            Copy company ID
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem icon={<CreditCard />} disabled hint="Billing">
                            Change plan
                          </MenuItem>
                          <MenuItem icon={<Ban />} disabled hint="Needs login" className="text-danger-ink">
                            Suspend company
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

      {result.total > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted sm:px-5">
          <span className="tabular">
            {from}–{to} of {result.total}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="me-2 hidden tabular sm:inline">
              Page {result.page + 1} of {result.pageCount}
            </span>
            <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={result.page === 0} onClick={() => setQuery((q) => ({ ...q, page: result.page - 1 }))}>
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={result.page >= result.pageCount - 1} onClick={() => setQuery((q) => ({ ...q, page: result.page + 1 }))}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title={
          detail && (
            <span className="flex items-center gap-3">
              <Avatar name={detail.name} square size="lg" />
              <span>
                {detail.name}
                <span className="block text-xs font-normal text-muted">
                  {detail.slug} · {detail.countryCode}
                </span>
              </span>
            </span>
          )
        }
        footer={
          detail && (
            <Button variant="secondary" onClick={() => copy(detail.id, "Company ID")}>
              <Copy /> Copy ID
            </Button>
          )
        }
      >
        {detail && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_META[displayStatus(detail)].tone} dot>
                {STATUS_META[displayStatus(detail)].label}
              </Badge>
              {!detail.usable && <Badge tone="danger">Access blocked</Badge>}
              {detail.cancelAtPeriodEnd && <Badge tone="warning">Cancels at period end</Badge>}
            </div>
            <section>
              <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">Subscription</h3>
              <dl className="mt-1 divide-y divide-line">
                <DetailRow label="Plan">{detail.planName}</DetailRow>
                <DetailRow label="Billing cycle">{detail.interval === "month" ? "Monthly" : "Annual"}</DetailRow>
                <DetailRow label="Seats">{detail.seats}</DetailRow>
                <DetailRow label={detail.renewalKind === "trial_end" ? "Trial ends" : detail.renewalKind === "ends" ? "Ends" : "Renews"}>{fmtDate(detail.renewsAt)}</DetailRow>
                <DetailRow label="Price">
                  <span className="text-muted">Not configured</span>
                </DetailRow>
              </dl>
            </section>
            <section>
              <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">Usage</h3>
              <dl className="mt-1 divide-y divide-line">
                <DetailRow label="Active drivers">
                  {detail.activeDrivers} / {detail.driverLimit ?? "∞"}
                </DetailRow>
                <DetailRow label="Customer since">{fmtDate(detail.createdAt)}</DetailRow>
              </dl>
            </section>
            <p className="rounded-md border border-dashed border-line bg-surface-2/60 p-3 text-xs leading-5 text-muted">
              Operational data (tours, stops, recipients) is intentionally not visible to platform admins. Plan changes and suspension will be available once billing and platform-admin login are connected.
            </p>
          </div>
        )}
      </Sheet>
    </Card>
  );
}
