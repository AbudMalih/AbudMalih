"use client";

import {
  AppShell,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
  cn,
  type Command,
  type NavGroup,
} from "@turvio/web-ui/ds";
import { Archive, BarChart3, CalendarDays, Check, Settings, ChevronDown, ClipboardCheck, LayoutGrid, MapPinned, PackageCheck, Route, ShieldCheck, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import { can } from "@turvio/shared";
import type { TFunction } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { Steering } from "./icons";
import { signOut } from "./SignOutButton";

/** Workspaces with keyboard shortcuts 1–5 (ignored while typing). */
export const VIEWS = [
  { href: "/map", key: "1" },
  { href: "/planning", key: "2" },
  { href: "/list", key: "3" },
  { href: "/pickups", key: "4" },
  { href: "/fleet", key: "5" },
] as const;

const ROLES = new Set(["owner", "admin", "dispatcher", "driver", "viewer"]);
export const roleLabel = (role: string, t: TFunction) => (ROLES.has(role) ? t(`common.role.${role as "owner"}`) : role);

function DepotSwitcher() {
  const { scoped, depotId, setDepotId, session } = useDispatch();
  const { t } = useI18n();
  const depots = scoped.depots;
  const current = depots.find((d) => d.id === depotId);
  const toursOf = (id: string | null) => scoped.tours.filter((t) => !id || t.depotId === id).length;
  const single = depots.length <= 1;
  return (
    <Menu>
      <MenuTrigger asChild disabled={single}>
        <Button variant="secondary" size="md" className="max-w-[230px] justify-start font-semibold hover:translate-y-0" aria-label={t("shell.depotLabel", { name: current?.name ?? t("shell.allDepots") })}>
          <Warehouse className="text-muted" />
          <span className="truncate">{current ? current.name : t("shell.allDepots")}</span>
          {!single && <ChevronDown className="ms-auto text-muted" />}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{session.companyWide ? t("shell.companyWide") : t("shell.yourDepots")}</MenuLabel>
        {depots.length > 1 && (
          <MenuItem onSelect={() => setDepotId(null)} hint={String(toursOf(null))} icon={depotId === null ? <Check className="!text-nx-violet-text" /> : <span className="size-4" />}>
            {t("shell.allDepots")}
          </MenuItem>
        )}
        <MenuSeparator />
        {depots.map((d) => (
          <MenuItem key={d.id} onSelect={() => setDepotId(d.id)} hint={t("common.tours", { count: toursOf(d.id) })} icon={depotId === d.id ? <Check className="!text-nx-violet-text" /> : <span className="size-4" />}>
            {d.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function DateControl() {
  const { date, setDate } = useDispatch();
  const t = useI18n().t;
  return (
    <label className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold focus-within:shadow-[var(--shadow-focus)] hover:border-line-3">
      <CalendarDays className="size-4 text-muted" aria-hidden="true" />
      <span className="sr-only">{t("shell.operatingDate")}</span>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="w-[118px] bg-transparent text-ink outline-none [&::-webkit-calendar-picker-indicator]:opacity-60"
        aria-describedby="date-hint"
      />
      <span id="date-hint" className="sr-only">
        {t("shell.dateHint")}
      </span>
    </label>
  );
}

function LiveIndicator() {
  const { live, loading, lastLoadedAt } = useDispatch();
  const { t, fmt } = useI18n();
  const label = live === "live" ? t("shell.liveOn") : live === "connecting" ? t("shell.liveConnecting") : t("shell.liveOff");
  return (
    <Tooltip content={t("shell.lastRefresh", { label, time: fmt.time(lastLoadedAt, true) })} side="bottom">
      <span className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-ink-2 md:inline-flex" role="status" aria-label={label}>
        <span className={cn("size-2 rounded-full", live === "live" ? "bg-nx-mint animate-nx-live" : live === "connecting" ? "bg-nx-amber" : "bg-muted", loading && "opacity-70")} />
        {live === "live" ? t("shell.live") : live === "connecting" ? "…" : t("shell.polling")}
      </span>
    </Tooltip>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/map";
  const params = useSearchParams();
  const router = useRouter();
  const { session, switchWorkspace, kpis, summaries, selectTour, scoped } = useDispatch();
  const { t } = useI18n();
  const tab = params?.get("tab");
  const view = params?.get("view");
  const current = pathname === "/fleet" ? `/fleet?tab=${tab ?? "drivers"}` : pathname === "/list" && view === "archived" ? "/list?view=archived" : pathname;

  // Keyboard: 1–5 switch workspaces (ignored while typing or with modifiers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)))) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v && pathname !== v.href) router.push(v.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  const isAdmin = session.role === "owner" || session.role === "admin";
  const canReports = can(session.role, "reports.view");
  const drafts = scoped.tours.filter((t) => t.status === "planned").length;
  const groups: NavGroup[] = [
    {
      label: t("shell.group.operations"),
      items: [
        { href: "/map", label: t("shell.nav.overview"), icon: LayoutGrid, shortcut: "1" },
        { href: "/planning", label: t("shell.nav.planning"), icon: ClipboardCheck, shortcut: "2", badge: drafts ? String(drafts) : undefined },
        { href: "/list", label: t("shell.nav.tours"), icon: Route, shortcut: "3" },
        { href: "/list?view=archived", label: t("shell.nav.archive"), icon: Archive },
        ...(canReports ? [{ href: "/analytics", label: t("shell.nav.analytics"), icon: BarChart3 }] : []),
        { href: "/pickups", label: t("shell.nav.pickups"), icon: PackageCheck, shortcut: "4", badge: kpis.pickupConflicts ? String(kpis.pickupConflicts) : undefined, badgeAlert: true },
      ],
    },
    {
      label: t("shell.group.resources"),
      items: [
        { href: "/fleet?tab=drivers", label: t("shell.nav.drivers"), icon: Steering, shortcut: "5" },
        { href: "/fleet?tab=vehicles", label: t("shell.nav.vehicles"), icon: Truck },
        { href: "/fleet?tab=depots", label: t("shell.nav.locations"), icon: MapPinned },
        ...(isAdmin ? [{ href: "/fleet?tab=team", label: t("shell.nav.team"), icon: ShieldCheck }] : []),
      ],
    },
    {
      label: t("shell.group.workspace"),
      items: [{ href: "/settings", label: t("shell.nav.settings"), icon: Settings }],
    },
  ];

  const commands = useMemo<Command[]>(
    () =>
      summaries.map((s) => ({
        id: `tour:${s.tour.id}`,
        label: `${s.tour.name}${s.driver ? ` · ${s.driver.displayName}` : ""}`,
        hint: t("shell.commandHint", { done: s.completed, total: s.total }),
        icon: Route,
        run: () => {
          selectTour(s.tour.id);
          if (pathname !== "/map") router.push("/map");
        },
      })),
    [summaries, selectTour, pathname, router, t],
  );

  const fullBleed = false;
  return (
    <AppShell
      product="Dispatch"
      groups={groups}
      current={current}
      user={{ name: session.userName, email: session.email, role: t("shell.userRole", { org: session.organizationName, role: roleLabel(session.role, t) }) }}
      userNote={session.companyWide ? t("shell.companyWide") : t("shell.depotLimited")}
      workspaces={session.workspaces.map((w) => ({ id: w.id, name: w.name, detail: roleLabel(w.role, t), current: w.id === session.organizationId, onSelect: () => switchWorkspace(w.id) }))}
      environment={session.environment ?? undefined}
      onSignOut={() => void signOut()}
      securityHref={null}
      commands={commands}
      navigate={(href) => router.push(href)}
      linkComponent={({ children: c, ...p }) => <Link {...p}>{c}</Link>}
      fullBleed={fullBleed}
      headerStart={
        <div className="hidden items-center gap-2 md:flex">
          <DepotSwitcher />
          <DateControl />
        </div>
      }
      headerActions={<LiveIndicator />}
    >
      {/* Depot and date on small screens */}
      <div className="flex items-center gap-2 overflow-x-auto md:hidden">
        <DepotSwitcher />
        <DateControl />
      </div>
      {children}
    </AppShell>
  );
}

export function DispatchShell({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
