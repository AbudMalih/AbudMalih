"use client";

import { AppShell, type Crumb, type NavGroup } from "@turvio/web-ui/ds";
import { Activity, Building2, CreditCard, LayoutDashboard, Server } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut, useAdminSession } from "../lib/session";

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/#companies", label: "Companies", icon: Building2 },
      { href: "/#activity", label: "Activity", icon: Activity },
    ],
  },
  { label: "Commercial", items: [{ href: "/plans", label: "Plans & limits", icon: CreditCard }] },
  { label: "Platform", items: [{ href: "/system", label: "System status", icon: Server }] },
];

export function AdminShell({ crumbs, actions, children }: { crumbs: Crumb[]; actions?: ReactNode; children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const session = useAdminSession();
  return (
    <AppShell
      product="Platform Admin"
      groups={GROUPS}
      current={pathname}
      workspaces={[{ id: "platform", name: "TURVIO Platform", detail: session.environment ?? "Lunapact Technologies", current: true }]}
      user={{ name: session.name, email: session.email, role: "Platform admin" }}
      crumbs={crumbs}
      headerActions={actions}
      environment={session.environment ?? undefined}
      onSignOut={() => void signOut()}
    >
      {children}
    </AppShell>
  );
}
