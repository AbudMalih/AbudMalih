"use client";

import {
  Avatar,
  Badge,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Toaster,
  Tooltip,
  TooltipProvider,
  TurvioLockup,
  TurvioMark,
  cn,
} from "@turvio/web-ui/ds";
import { Building2, CalendarDays, Check, ChevronDown, ClipboardList, List, LogOut, Map as MapIcon, PackageCheck, Truck, Warehouse } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDispatch } from "../lib/store";
import { OpsSummary } from "./OpsSummary";
import { signOut } from "./SignOutButton";

export const VIEWS = [
  { href: "/map", label: "Map", icon: MapIcon, key: "1" },
  { href: "/list", label: "List", icon: List, key: "2" },
  { href: "/planning", label: "Planning", icon: ClipboardList, key: "3" },
  { href: "/pickups", label: "Pickups", icon: PackageCheck, key: "4" },
  { href: "/fleet", label: "Fleet", icon: Truck, key: "5" },
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
        <Button variant="secondary" size="md" className="max-w-[220px] justify-start" aria-label={`Depot: ${current?.name ?? "All depots"}`}>
          <Warehouse className="text-subtle" />
          <span className="truncate">{current ? current.name : "All depots"}</span>
          {!single && <ChevronDown className="ms-auto text-subtle" />}
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{session.companyWide ? "Company-wide access" : "Your depots"}</MenuLabel>
        {depots.length > 1 && (
          <MenuItem onSelect={() => setDepotId(null)} hint={String(toursOf(null))} icon={depotId === null ? <Check className="!text-brand-600" /> : <span className="size-4" />}>
            All depots
          </MenuItem>
        )}
        <MenuSeparator />
        {depots.map((d) => (
          <MenuItem key={d.id} onSelect={() => setDepotId(d.id)} hint={`${toursOf(d.id)} tours`} icon={depotId === d.id ? <Check className="!text-brand-600" /> : <span className="size-4" />}>
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
    <label className="relative inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm shadow-xs focus-within:shadow-[var(--shadow-focus)] hover:border-line-strong">
      <CalendarDays className="size-4 text-subtle" aria-hidden="true" />
      <span className="sr-only">Operating date</span>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="w-[118px] bg-transparent text-ink outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
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
      <span className="hidden items-center gap-1.5 rounded-full border border-line px-2 py-1 text-2xs font-medium text-muted md:inline-flex" role="status" aria-label={label}>
        <span className={cn("size-2 rounded-full", live === "live" ? "bg-success" : live === "connecting" ? "bg-warning" : "bg-subtle", loading && "animate-pulse")} />
        {live === "live" ? "Live" : live === "connecting" ? "…" : "Polling"}
      </span>
    </Tooltip>
  );
}

export function DispatchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/map";
  const router = useRouter();
  const { session, switchWorkspace } = useDispatch();

  // Keyboard: 1–4 switch views (ignored while typing).
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

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div className="flex h-dvh min-h-0 flex-col bg-canvas">
          <header className="z-30 shrink-0 border-b border-line bg-surface">
            <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
              <Link href="/map" className="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:shadow-[var(--shadow-focus)]" aria-label="TURVIO Dispatch home">
                <TurvioLockup height={18} className="hidden sm:block" />
                <TurvioMark size={22} className="sm:hidden" />
                <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
                <span className="hidden text-[13px] font-medium text-muted sm:block">Dispatch</span>
              </Link>
              {session.environment && (
                <Tooltip content={session.environment} side="bottom">
                  <span className="hidden sm:inline-flex xl:hidden">
                    <Badge tone="warning" dot>
                      Dev
                    </Badge>
                  </span>
                </Tooltip>
              )}

              <nav aria-label="Workspaces" className="ms-2 hidden lg:block">
                <ul className="flex items-center gap-0.5">
                  {VIEWS.map((v) => {
                    const active = pathname.startsWith(v.href);
                    const Icon = v.icon;
                    return (
                      <li key={v.href} className="relative">
                        <Tooltip content={`${v.label} · press ${v.key}`} side="bottom">
                          <Link
                            href={v.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "relative flex h-9 items-center gap-2 rounded-md px-3 text-[13.5px] font-medium outline-none transition-colors focus-visible:shadow-[var(--shadow-focus)]",
                              active ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
                            )}
                          >
                            {active && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-md bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                            <Icon className={cn("relative size-4", active ? "text-brand-600" : "text-subtle")} />
                            <span className="relative hidden xl:inline">{v.label}</span>
                            <span className="sr-only xl:hidden">{v.label}</span>
                          </Link>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="ms-auto flex min-w-0 items-center gap-2">
                {session.environment && (
                  <div className="hidden xl:block">
                    <Badge tone="warning" dot>
                      {session.environment}
                    </Badge>
                  </div>
                )}
                <LiveIndicator />
                <div className="hidden sm:flex sm:items-center sm:gap-2">
                  <DepotSwitcher />
                  <DateControl />
                </div>
                <Menu>
                  <MenuTrigger asChild>
                    <button className="rounded-full outline-none focus-visible:shadow-[var(--shadow-focus)]" aria-label={`Account: ${session.userName}`}>
                      <Avatar name={session.userName} size="md" />
                    </button>
                  </MenuTrigger>
                  <MenuContent className="w-64">
                    <div className="px-2 py-1.5">
                      <div className="text-[13px] font-medium">{session.userName}</div>
                      <div className="text-2xs text-muted">
                        {session.organizationName} · {session.role}
                      </div>
                      <div className="mt-1 text-2xs text-subtle">{session.companyWide ? "Company-wide access" : "Access limited to assigned depots"}</div>
                    </div>
                    {session.workspaces.length > 1 && (
                      <>
                        <MenuSeparator />
                        <MenuLabel>Switch company</MenuLabel>
                        {session.workspaces.map((w) => (
                          <MenuItem
                            key={w.id}
                            icon={w.id === session.organizationId ? <Check className="!text-brand-600" /> : <Building2 />}
                            hint={w.role}
                            onSelect={() => w.id !== session.organizationId && switchWorkspace(w.id)}
                          >
                            {w.name}
                          </MenuItem>
                        ))}
                      </>
                    )}
                    <MenuSeparator />
                    <MenuItem icon={<LogOut />} onSelect={() => void signOut()}>
                      Sign out
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            </div>
            {/* Compact controls row for small screens */}
            <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2 sm:hidden">
              <DepotSwitcher />
              <DateControl />
            </div>
            <OpsSummary />
          </header>
          <div className="relative min-h-0 flex-1 pb-[60px] lg:pb-0">{children}</div>
          {/* Bottom tab bar on phones/tablets */}
          <nav aria-label="Workspaces" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
            <ul className="grid grid-cols-5">
              {VIEWS.map((v) => {
                const active = pathname.startsWith(v.href);
                const Icon = v.icon;
                return (
                  <li key={v.href}>
                    <Link href={v.href} aria-current={active ? "page" : undefined} className={cn("flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-brand-600" : "text-muted")}>
                      <Icon className="size-5" />
                      {v.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}
