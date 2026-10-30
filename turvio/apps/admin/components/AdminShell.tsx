import { Shell } from "@turvio/web-ui";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Companies" },
  { href: "/plans", label: "Plans & limits" },
  { href: "/system", label: "System" },
];

export function AdminShell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <Shell product="Platform Admin" nav={NAV} current={current} footer="Lunapact Technologies">
      <div className="banner" role="note">
        Development mode: synthetic tenants, platform-admin login not yet connected. Payments are disabled.
      </div>
      {children}
    </Shell>
  );
}
