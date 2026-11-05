"use client";

import { Check, ChevronRight, ChevronsUpDown, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { cn } from "./cn";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "./Menu";
import { Sheet } from "./Sheet";
import { Toaster } from "./Toaster";
import { Tooltip, TooltipProvider } from "./Tooltip";
import { Wordmark } from "./Wordmark";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Small count/label on the right, e.g. number of trials. */
  badge?: string;
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

const STORAGE_KEY = "turvio.sidebar.collapsed";

function isActive(current: string, href: string) {
  return href === "/" ? current === "/" : current === href || current.startsWith(`${href}/`);
}

function NavLinks({ groups, current, collapsed, onNavigate }: { groups: NavGroup[]; current: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <LayoutGroup id="sidebar-nav">
      <nav aria-label="Main" className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.label}>
            <div
              className={cn(
                "mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle transition-opacity duration-[var(--duration-base)]",
                collapsed && "h-0 overflow-hidden opacity-0",
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
                    <Tooltip content={item.label} side="right" disabled={!collapsed}>
                      <a
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium outline-none transition-colors duration-[var(--duration-fast)] focus-visible:shadow-[var(--shadow-focus)]",
                          active ? "text-ink" : "text-muted hover:bg-surface-2/80 hover:text-ink",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-md border border-line bg-surface shadow-xs"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        {active && <span className="absolute start-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-600" aria-hidden="true" />}
                        <Icon className={cn("relative size-4 shrink-0 transition-colors", active ? "text-brand-600" : "text-subtle group-hover:text-ink-2")} />
                        {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className="relative rounded-full bg-surface-2 px-1.5 text-2xs font-semibold text-muted tabular">{item.badge}</span>
                        )}
                      </a>
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

function WorkspaceSwitcher({ workspaces, collapsed }: { workspaces: WorkspaceOption[]; collapsed: boolean }) {
  const current = workspaces.find((w) => w.current) ?? workspaces[0]!;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md border border-line bg-surface p-2 text-start shadow-xs outline-none transition-colors hover:border-line-strong focus-visible:shadow-[var(--shadow-focus)]",
            collapsed && "justify-center border-transparent bg-transparent p-1 shadow-none",
          )}
          aria-label={`Workspace: ${current.name}`}
        >
          <Avatar name={current.name} size="sm" square />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{current.name}</span>
                <span className="block truncate text-2xs text-muted">{current.detail}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />
            </>
          )}
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>Workspaces</MenuLabel>
        {workspaces.map((w) => (
          <MenuItem key={w.id} disabled={w.disabled} icon={<Avatar name={w.name} size="sm" square />} hint={w.disabled ? w.disabledHint : undefined}>
            <span className="flex items-center justify-between gap-2">
              <span>
                <span className="block text-[13px] font-medium">{w.name}</span>
                <span className="block text-2xs text-muted">{w.detail}</span>
              </span>
              {w.current && <Check className="size-4 !text-brand-600" />}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function UserMenu({ user, collapsed, note, onSignOut }: { user: ShellUser; collapsed: boolean; note?: string; onSignOut?: () => void }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md p-2 text-start outline-none transition-colors hover:bg-surface-2 focus-visible:shadow-[var(--shadow-focus)]",
            collapsed && "justify-center p-1",
          )}
          aria-label={`Account: ${user.name}`}
        >
          <Avatar name={user.name} size="sm" />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
              <span className="block truncate text-2xs text-muted">{user.role}</span>
            </span>
          )}
        </button>
      </MenuTrigger>
      <MenuContent align="start" side="top" className="w-60">
        <div className="px-2 py-1.5">
          <div className="text-[13px] font-medium">{user.name}</div>
          <div className="text-2xs text-muted">{user.email}</div>
        </div>
        <MenuSeparator />
        <MenuItem icon={<LogOut />} disabled={!onSignOut} onSelect={() => onSignOut?.()}>
          Sign out
        </MenuItem>
        {note && <p className="px-2 pb-1.5 pt-1 text-2xs leading-4 text-subtle">{note}</p>}
      </MenuContent>
    </Menu>
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
  environment,
  onSignOut,
  children,
}: {
  product: string;
  groups: NavGroup[];
  current: string;
  workspaces: WorkspaceOption[];
  user: ShellUser;
  userNote?: string;
  crumbs: Crumb[];
  headerActions?: ReactNode;
  environment?: string;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable – keep default */
    }
  }, []);

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

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div className="flex min-h-dvh bg-canvas">
          {/* Desktop sidebar */}
          <aside
            className={cn(
              "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-line bg-canvas transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-quart)] lg:flex",
              collapsed ? "w-[68px]" : "w-64",
            )}
          >
            <div className={cn("flex h-14 items-center justify-between gap-2 px-4", collapsed && "justify-center px-0")}>
              <a href="/" aria-label={`TURVIO ${product} home`} className="rounded-md outline-none focus-visible:shadow-[var(--shadow-focus)]">
                <Wordmark product={product} collapsed={collapsed} />
              </a>
            </div>
            <div className={cn("px-3 pb-3", collapsed && "px-2")}>
              <WorkspaceSwitcher workspaces={workspaces} collapsed={collapsed} />
            </div>
            <div className={cn("flex-1 overflow-y-auto px-3 py-2", collapsed && "px-2")}>
              <NavLinks groups={groups} current={current} collapsed={collapsed} />
            </div>
            <div className={cn("flex flex-col gap-1 border-t border-line p-3", collapsed && "items-center p-2")}>
              <UserMenu user={user} collapsed={collapsed} note={userNote} onSignOut={onSignOut} />
              <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
                <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="self-end text-subtle">
                  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </Tooltip>
            </div>
          </aside>

          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title={<Wordmark product={product} />} className="max-w-[300px]">
            <div className="flex flex-col gap-4">
              <WorkspaceSwitcher workspaces={workspaces} collapsed={false} />
              <NavLinks groups={groups} current={current} collapsed={false} onNavigate={() => setMobileOpen(false)} />
              <div className="border-t border-line pt-3">
                <UserMenu user={user} collapsed={false} note={userNote} onSignOut={onSignOut} />
              </div>
            </div>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70 sm:px-6">
              <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <MenuIcon />
              </Button>
              <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
                  {crumbs.map((c, i) => (
                    <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                      {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />}
                      {c.href && i < crumbs.length - 1 ? (
                        <a href={c.href} className="truncate text-muted transition-colors hover:text-ink">
                          {c.label}
                        </a>
                      ) : (
                        <span className={cn("truncate", i === crumbs.length - 1 ? "font-medium text-ink" : "text-muted")} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                          {c.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
              {environment && (
                <Badge tone="warning" dot className="hidden sm:inline-flex">
                  {environment}
                </Badge>
              )}
              {headerActions}
            </header>
            <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
