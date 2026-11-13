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
import { CalendarDays, Check, ChevronDown, ClipboardCheck, LayoutGrid, MapPinned, PackageCheck, Route, ShieldCheck, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useDispatch } from "../lib/store";
import { Steering } from "./icons";
import { signOut } from "./SignOutButton";

/** Workspaces with keyboard shortcuts 1–5 (ignored while typing). */
export const VIEWS = [
  { href: "/map", label: "Overview", key: "1" },
  { href: "/planning", label: "Planning", key: "2" },
  { href: "/list", label: "Tours", key: "3" },
  { href: "/pickups", label: "Pickups", key: "4" },
  { href: "/fleet", label: "Fleet & team", key: "5" },
] as const;

function DepotSwitcher() {
  const { scoped, depotId, setDepotId, session } = useDispatch();
  const depots = scoped.depots;
  const current = depots.find((d) => d.id === depotId);
  const toursOf = (id: string | null) => scoped.tours.filter((t) => !id || t.depotId === id).length;
  const single = depots.length <= 1;
  return (
    <Menu>
      <MenuTrigger asChild disabled={single}>
        <Button variant="secondary" size="md" className="max-w-[230px] justify-start font-semibold hover:translate-y-0" aria-label={`Depot: ${current?.name ?? "All depots"}`}>
          <Warehouse className="text-muted" />
          <span className="truncate">{current ? current.name : "All depots"}</span>
          {!single && <ChevronDown className="ms-auto text-muted" />}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{session.companyWide ? "Company-wide access" : "Your depots"}</MenuLabel>
        {depots.length > 1 && (
          <MenuItem onSelect={() => setDepotId(null)} hint={String(toursOf(null))} icon={depotId === null ? <Check className="!text-nx-violet-text" /> : <span className="size-4" />}>
            All depots
          </MenuItem>
        )}
        <MenuSeparator />
        {depots.map((d) => (
          <MenuItem key={d.id} onSelect={() => setDepotId(d.id)} hint={`${toursOf(d.id)} tours`} icon={depotId === d.id ? <Check className="!text-nx-violet-text" /> : <span className="size-4" />}>
            {d.name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function DateControl() {
  const { date, setDate } = useDispatch();
  return (
    <label className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold focus-within:shadow-[var(--shadow-focus)] hover:border-line-3">
      <CalendarDays className="size-4 text-muted" aria-hidden="true" />
      <span className="sr-only">Operating date</span>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="w-[118px] bg-transparent text-ink outline-none [&::-webkit-calendar-picker-indicator]:opacity-60"
        aria-describedby="date-hint"
      />
      <span id="date-hint" className="sr-only">
        Shows tours planned for the selected day.
      </span>
    </label>
  );
}

function LiveIndicator() {
  const { live, loading, lastLoadedAt } = useDispatch();
  const label = live === "live" ? "Live – updates appear automatically" : live === "connecting" ? "Connecting…" : "Live updates unavailable – refreshing every minute";
  return (
    <Tooltip content={`${label} · last refresh ${new Date(lastLoadedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`} side="bottom">
      <span className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-ink-2 md:inline-flex" role="status" aria-label={label}>
        <span className={cn("size-2 rounded-full", live === "live" ? "bg-nx-mint animate-nx-live" : live === "connecting" ? "bg-nx-amber" : "bg-muted", loading && "opacity-70")} />
        {live === "live" ? "Live" : live === "connecting" ? "…" : "Polling"}
      </span>
    </Tooltip>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/map";
  const params = useSearchParams();
  const router = useRouter();
  const { session, switchWorkspace, kpis, summaries, selectTour, scoped } = useDispatch();
  const tab = params?.get("tab");
  const current = pathname === "/fleet" ? `/fleet?tab=${tab ?? "drivers"}` : pathname;

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
  const drafts = scoped.tours.filter((t) => t.status === "planned").length;
  const groups: NavGroup[] = [
    {
      label: "Operations",
      items: [
        { href: "/map", label: "Overview", icon: LayoutGrid, shortcut: "1" },
        { href: "/planning", label: "Planning", icon: ClipboardCheck, shortcut: "2", badge: drafts ? String(drafts) : undefined },
        { href: "/list", label: "Tours", icon: Route, shortcut: "3" },
        { href: "/pickups", label: "Pickups", icon: PackageCheck, shortcut: "4", badge: kpis.pickupConflicts ? String(kpis.pickupConflicts) : undefined, badgeAlert: true },
      ],
    },
    {
      label: "Resources",
      items: [
        { href: "/fleet?tab=drivers", label: "Drivers", icon: Steering, shortcut: "5" },
        { href: "/fleet?tab=vehicles", label: "Vehicles", icon: Truck },
        { href: "/fleet?tab=depots", label: "Locations", icon: MapPinned },
        ...(isAdmin ? [{ href: "/fleet?tab=team", label: "Team", icon: ShieldCheck }] : []),
      ],
    },
  ];

  const commands = useMemo<Command[]>(
    () =>
      summaries.map((s) => ({
        id: `tour:${s.tour.id}`,
        label: `${s.tour.name}${s.driver ? ` · ${s.driver.displayName}` : ""}`,
        hint: `${s.completed}/${s.total} stops`,
        icon: Route,
        run: () => {
          selectTour(s.tour.id);
          if (pathname !== "/map") router.push("/map");
        },
      })),
    [summaries, selectTour, pathname, router],
  );

  const fullBleed = false;
  return (
    <AppShell
      product="Dispatch"
      groups={groups}
      current={current}
      user={{ name: session.userName, email: session.email, role: `${session.organizationName} · ${session.role}` }}
      userNote={session.companyWide ? "Company-wide access" : "Access limited to assigned depots"}
      workspaces={session.workspaces.map((w) => ({ id: w.id, name: w.name, detail: w.role, current: w.id === session.organizationId, onSelect: () => switchWorkspace(w.id) }))}
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
