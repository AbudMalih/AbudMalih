"use client";

import { AppShell, type NavGroup } from "@turvio/web-ui/ds";
import { Building2, CreditCard, LayoutGrid, ScrollText, Server } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { signOut, useAdminSession } from "../lib/session";

/*
 * Navigation follows the approved Admin prototype (design/next/admin), limited to what TURVIO Admin
 * really is: platform administration. Every entry is its own route, rendered inside this shell
 * (mounted once in app/(app)/layout.tsx) and reached by client-side navigation.
 */
export const GROUPS: NavGroup[] = [
  { label: "Operations", items: [{ href: "/", label: "Overview", icon: LayoutGrid, shortcut: "1" }] },
  {
    label: "Management",
    items: [
      { href: "/companies", label: "Organizations", icon: Building2, shortcut: "2" },
      { href: "/plans", label: "Plans & limits", icon: CreditCard, shortcut: "3" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/system", label: "System status", icon: Server, shortcut: "4" },
      { href: "/activity", label: "Audit log", icon: ScrollText, shortcut: "5" },
    ],
  },
];
const ROUTES = GROUPS.flatMap((g) => g.items);

const NextLink = ({ children, ...p }: { href: string; className?: string; onClick?: () => void; "aria-current"?: "page"; children: ReactNode }) => (
  <Link {...p} prefetch>
    {children}
  </Link>
);

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const session = useAdminSession();

  // Warm every route once, so the first switch is as fast as the next ones.
  useEffect(() => {
    for (const r of ROUTES) router.prefetch(r.href);
  }, [router]);

  // Keyboard: 1–5 switch pages (ignored while typing or with modifiers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)))) return;
      const r = ROUTES.find((x) => x.shortcut === e.key);
      if (r && r.href !== pathname) router.push(r.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return (
    <AppShell
      product="Platform Admin"
      groups={GROUPS}
      current={pathname}
      user={{ name: session.name, email: session.email, role: "Platform admin" }}
      environment={session.environment ?? undefined}
      onSignOut={() => void signOut()}
      navigate={(href) => router.push(href)}
      linkComponent={NextLink}
    >
      {children}
    </AppShell>
  );
}
