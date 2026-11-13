"use client";

import { Building2, Check, ChevronLeft, CornerDownLeft, LogOut, Menu as MenuIcon, Search, ShieldCheck } from "lucide-react";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { cn } from "./cn";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "./Menu";
import { Sheet } from "./Sheet";
import { ThemeSwitch } from "./Theme";
import { Toaster } from "./Toaster";
import { Tooltip, TooltipProvider } from "./Tooltip";
import { TurvioLockup, TurvioMark } from "./Wordmark";

/*
 * TURVIO NEXT application shell – design/next/*: .app/.side/.nav/.topbar/.page.
 * Sidebar 264 px (84 px collapsed), grouped navigation with the violet active pill and the cyan→violet
 * edge bar, profile card at the bottom; sticky translucent top bar with search (⌘K), theme switch and
 * environment badge. Only real destinations and actions are shown – no placeholder features.
 */

/** Any lucide-compatible icon component. */
export type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

export interface NavItem {
  href: string;
  label: string;
  icon: IconComponent;
  /** Small count on the right, e.g. open items. */
  badge?: string;
  /** Show the count in the alert style (coral). */
  badgeAlert?: boolean;
  /** Keyboard shortcut shown in the tooltip, e.g. "1". */
  shortcut?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}
export interface WorkspaceOption {
  id: string;
  name: string;
  detail: string;
  current?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onSelect?: () => void;
}
export interface ShellUser {
  name: string;
  email: string;
  role: string;
}
export interface Crumb {
  label: string;
  href?: string;
}
/** An entry of the command palette (⌘K): navigation targets are added automatically. */
export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: IconComponent;
  run: () => void;
}

const STORAGE_KEY = "turvio.sidebar.collapsed";

function isActive(current: string, href: string) {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

function NavLinks({ groups, current, collapsed, onNavigate, linkComponent: A }: { groups: NavGroup[]; current: string; collapsed: boolean; onNavigate?: () => void; linkComponent: LinkLike }) {
  return (
    <LayoutGroup id="sidebar-nav">
      <nav aria-label="Main" className="flex flex-col">
        {groups.map((group) => (
          <div key={group.label}>
            <div
              className={cn(
                "whitespace-nowrap px-3 pb-1.5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.09em] text-muted transition-opacity duration-200",
                collapsed && "h-3.5 overflow-hidden pt-1.5 opacity-0",
              )}
            >
              {group.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(current, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Tooltip content={item.shortcut ? `${item.label} · ${item.shortcut}` : item.label} side="right" disabled={!collapsed}>
                      <A
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-[42px] items-center gap-[13px] whitespace-nowrap rounded-xl px-3 text-sm font-semibold outline-none transition-colors duration-200 focus-visible:shadow-[var(--shadow-focus)]",
                          active ? "text-ink" : "text-ink-2 hover:bg-[rgba(166,180,224,.06)] hover:text-ink",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-xl bg-nx-violet-soft shadow-[inset_0_0_0_1px_rgba(117,91,255,.28)]"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          >
                            <span className="absolute -start-3.5 top-[11px] h-5 w-[3px] rounded-[3px] bg-[linear-gradient(var(--cyan),var(--violet))]" aria-hidden="true" />
                          </motion.span>
                        )}
                        <Icon className={cn("relative size-5 shrink-0 transition-transform duration-300 ease-[var(--ease-spring)] group-active:scale-[0.88]", active && "text-nx-violet-text")} strokeWidth={1.8} />
                        <span className={cn("relative flex-1 truncate transition-opacity duration-200", collapsed && "pointer-events-none opacity-0")}>{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              "relative rounded-full border px-[7px] py-px text-[11.5px] font-bold tabular",
                              item.badgeAlert ? "border-transparent bg-nx-coral-soft text-nx-coral" : "border-line bg-surface-2 text-muted",
                              collapsed && "absolute end-2 top-1.5 size-2 border-0 p-0 text-[0px]",
                              collapsed && (item.badgeAlert ? "bg-nx-coral" : "bg-muted"),
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </A>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );
}

function ProfileCard({
  user,
  collapsed,
  note,
  environment,
  workspaces,
  extraMenu,
  onSignOut,
  securityHref,
}: {
  user: ShellUser;
  collapsed: boolean;
  note?: string;
  environment?: string;
  workspaces?: WorkspaceOption[];
  extraMenu?: ReactNode;
  onSignOut?: () => void;
  securityHref?: string;
}) {
  const switchable = (workspaces?.length ?? 0) > 1;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-[11px] rounded-[14px] border border-line bg-surface p-2 text-start outline-none transition-colors duration-200 hover:border-line-strong focus-visible:shadow-[var(--shadow-focus)]",
          )}
          aria-label={`Account: ${user.name}`}
        >
          <span className="relative shrink-0">
            <Avatar name={user.name} />
            {environment && <span className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-surface bg-nx-amber" title={environment} />}
          </span>
          <span className={cn("min-w-0 flex-1 transition-opacity duration-200", collapsed && "pointer-events-none opacity-0")}>
            <span className="block truncate text-[13px] font-bold text-ink">{user.name}</span>
            <span className="block truncate text-[11.5px] text-muted">{user.role}</span>
          </span>
        </button>
      </MenuTrigger>
      <MenuContent align="start" side="top" className="w-64">
        <div className="px-2.5 py-1.5">
          <div className="text-[13px] font-bold">{user.name}</div>
          <div className="text-[11.5px] font-medium text-muted">{user.email}</div>
          {note && <p className="mt-1 text-[11.5px] font-medium leading-4 text-muted">{note}</p>}
        </div>
        {switchable && (
          <>
            <MenuSeparator />
            <MenuLabel>Switch company</MenuLabel>
            {workspaces!.map((w) => (
              <MenuItem
                key={w.id}
                disabled={w.disabled}
                icon={w.current ? <Check className="!text-nx-violet-text" /> : <Building2 />}
                hint={w.disabled ? w.disabledHint : w.detail}
                onSelect={() => !w.current && w.onSelect?.()}
              >
                {w.name}
              </MenuItem>
            ))}
          </>
        )}
        {extraMenu}
        <MenuSeparator />
        {securityHref && (
          <MenuItem icon={<ShieldCheck />} onSelect={() => window.location.assign(securityHref)}>
            Two-step verification
          </MenuItem>
        )}
        <MenuItem icon={<LogOut />} disabled={!onSignOut} onSelect={() => onSignOut?.()}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

type LinkLike = (p: { href: string; className?: string; onClick?: () => void; "aria-current"?: "page"; children: ReactNode }) => ReactNode;
const PlainLink: LinkLike = ({ children, ...p }) => <a {...p}>{children}</a>;

function Sidebar({
  product,
  groups,
  current,
  collapsed,
  onToggle,
  onNavigate,
  footer,
  linkComponent,
  mobile = false,
}: {
  product: string;
  groups: NavGroup[];
  current: string;
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  footer: ReactNode;
  linkComponent: LinkLike;
  mobile?: boolean;
}) {
  const A = linkComponent;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <A href="/" className="mb-1 flex min-h-[58px] flex-col justify-center gap-1 rounded-xl px-2 pb-5 pt-1 outline-none focus-visible:shadow-[var(--shadow-focus)]" aria-current={undefined}>
        {collapsed && !mobile ? (
          <span className="flex justify-center">
            <TurvioMark size={26} />
          </span>
        ) : (
          <>
            <TurvioLockup height={26} />
            <span className="whitespace-nowrap text-[11.5px] font-semibold tracking-[0.02em] text-muted">{product}</span>
          </>
        )}
      </A>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1">
        <NavLinks groups={groups} current={current} collapsed={collapsed && !mobile} onNavigate={onNavigate} linkComponent={linkComponent} />
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line pt-3">
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-[38px] items-center gap-3 whitespace-nowrap rounded-[10px] px-3 text-sm font-semibold text-muted outline-none transition-colors hover:bg-[rgba(166,180,224,.06)] hover:text-ink focus-visible:shadow-[var(--shadow-focus)]"
          >
            <ChevronLeft className={cn("size-[18px] shrink-0 transition-transform duration-300 ease-[var(--ease-out-quart)] rtl:rotate-180", collapsed && "rotate-180 rtl:rotate-0")} />
            <span className={cn("transition-opacity duration-200", collapsed && "opacity-0")}>Collapse</span>
          </button>
        )}
        {footer}
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n ? commands.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(n)) : commands).slice(0, 40);
  }, [q, commands]);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => input.current?.focus(), 20);
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);
  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };
  return (
    <>
      <div className={cn("fixed inset-0 z-[80] bg-[color:var(--scrim)] backdrop-blur-[4px] transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        aria-hidden={!open}
        className={cn(
          "fixed left-1/2 top-[12vh] z-[81] w-[min(620px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-[22px] border border-line-strong bg-raised shadow-overlay transition-[opacity,transform] duration-300 ease-[var(--ease-spring)]",
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2.5 scale-[0.97] opacity-0",
        )}
      >
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, list.length - 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
            else if (e.key === "Enter") run(list[sel]);
          }}
          placeholder="Search pages and actions…"
          aria-label="Search pages and actions"
          className="h-[58px] w-full border-0 border-b border-line bg-transparent px-5 text-base text-ink outline-none placeholder:text-muted"
          tabIndex={open ? 0 : -1}
        />
        <div className="max-h-[360px] overflow-auto p-2" role="listbox">
          {list.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">No matches</p>}
          {list.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === sel}
                tabIndex={-1}
                onMouseEnter={() => setSel(i)}
                onClick={() => run(c)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-ink", i === sel && "bg-surface-2")}
              >
                {Icon && <Icon className="size-[18px] shrink-0 text-muted" />}
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.hint && <span className="shrink-0 text-xs font-semibold text-muted">{c.hint}</span>}
                {i === sel && <CornerDownLeft className="size-3.5 shrink-0 text-muted" />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function AppShell({
  product,
  groups,
  current,
  workspaces,
  user,
  userNote,
  crumbs,
  headerActions,
  headerStart,
  environment,
  onSignOut,
  securityHref = "/security",
  commands = [],
  navigate,
  linkComponent = PlainLink,
  fullBleed = false,
  userMenuExtra,
  children,
}: {
  product: string;
  groups: NavGroup[];
  current: string;
  workspaces?: WorkspaceOption[];
  user: ShellUser;
  userNote?: string;
  /** Optional: shown on small screens next to the menu button (the page title carries context on desktop). */
  crumbs?: Crumb[];
  headerActions?: ReactNode;
  /** Extra controls after the search field (e.g. depot and date pickers). */
  headerStart?: ReactNode;
  environment?: string;
  onSignOut?: () => void;
  securityHref?: string | null;
  /** Extra command-palette entries; the navigation items are always included. */
  commands?: Command[];
  /** Client-side navigation (e.g. Next router.push); defaults to a full page load. */
  navigate?: (href: string) => void;
  /** Link component for client-side navigation (e.g. next/link). */
  linkComponent?: LinkLike;
  /** Map workspaces: no page padding, the content fills the remaining height. */
  fullBleed?: boolean;
  userMenuExtra?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable – keep default */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback((href: string) => (navigate ? navigate(href) : window.location.assign(href)), [navigate]);
  const allCommands = useMemo<Command[]>(
    () => [...groups.flatMap((g) => g.items.map((i) => ({ id: `nav:${i.href}`, label: i.label, hint: g.label, icon: i.icon, run: () => go(i.href) }))), ...commands],
    [groups, commands, go],
  );

  const toggle = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const profile = (isCollapsed: boolean) => (
    <ProfileCard user={user} collapsed={isCollapsed} note={userNote} environment={environment} workspaces={workspaces} extraMenu={userMenuExtra} onSignOut={onSignOut} securityHref={securityHref ?? undefined} />
  );
  const title = crumbs?.at(-1)?.label;

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div className={cn("grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[auto_minmax(0,1fr)]", fullBleed && "h-dvh")}>
          {/* Desktop sidebar */}
          <aside
            className={cn(
              "sticky top-0 z-30 hidden h-dvh flex-col border-e border-line bg-sidebar px-3.5 pb-3.5 pt-[18px] transition-[width] duration-[340ms] ease-[var(--ease-out-quart)] lg:flex",
              collapsed ? "w-[84px]" : "w-[264px]",
            )}
          >
            <Sidebar product={product} groups={groups} current={current} collapsed={collapsed} onToggle={toggle} footer={profile(collapsed)} linkComponent={linkComponent} />
          </aside>

          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title={<span className="sr-only">Navigation</span>} className="max-w-[288px] bg-sidebar [&>div:first-child]:hidden [&>div:nth-child(2)]:px-3.5 [&>div:nth-child(2)]:pt-[18px]">
            <Sidebar product={product} groups={groups} current={current} collapsed={false} onNavigate={() => setMobileOpen(false)} footer={profile(false)} linkComponent={linkComponent} mobile />
          </Sheet>

          <div className={cn("flex min-w-0 flex-col", fullBleed && "h-dvh min-h-0")}>
            <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-4 py-2.5 backdrop-blur-[16px] backdrop-saturate-[1.3] sm:px-7 lg:py-3.5">
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition-colors hover:border-line-strong hover:text-ink active:scale-[0.93] lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <MenuIcon className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-start font-medium text-muted transition-[border-color] hover:border-line-strong sm:w-[min(380px,40vw)] sm:flex-none"
                aria-label="Search pages and actions (Ctrl K)"
              >
                <Search className="size-[18px] shrink-0" />
                <span className="hidden truncate text-sm sm:inline">{title && fullBleed ? title : "Search…"}</span>
                <span className="ms-auto hidden rounded-md border border-line-strong px-[7px] py-0.5 text-[11px] font-bold text-muted sm:inline">⌘K</span>
              </button>
              {headerStart}
              <div className="ms-auto flex shrink-0 items-center gap-2">
                {environment && (
                  <span className="hidden h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-nx-amber-soft px-2.5 text-[11.5px] font-bold text-nx-amber xl:inline-flex" title={environment}>
                    <span className="size-1.5 rounded-full bg-nx-amber" aria-hidden="true" />
                    {environment}
                  </span>
                )}
                {headerActions}
                <ThemeSwitch />
              </div>
            </header>
            <main
              className={cn(
                fullBleed ? "relative min-h-0 flex-1" : "flex w-full max-w-[1680px] flex-1 flex-col gap-5 px-4 pb-12 pt-5 sm:px-7 sm:pt-6",
                "animate-nx-view",
              )}
            >
              {children}
            </main>
          </div>
        </div>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={allCommands} />
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}

/** .page-head: 26 px / 800 title, optional demo pill, subtitle; actions at the end. */
export function PageHeader({ title, description, actions, tag }: { title: string; description?: ReactNode; actions?: ReactNode; tag?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance text-ink">{title}</h1>
          {tag}
        </div>
        {description && <div className="mt-1 text-sm text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">{actions}</div>}
    </div>
  );
}
