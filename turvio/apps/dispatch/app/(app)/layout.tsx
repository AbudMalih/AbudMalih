import { can, type DispatchDataset } from "@turvio/shared";
import { AuthLayout, FormAlert } from "@turvio/web-ui/ds";
import { COOKIES, serverApi, type Me } from "@turvio/web-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DispatchShell } from "../../components/DispatchShell";
import { SignOutButton } from "../../components/SignOutButton";
import { DispatchProvider, type SessionInfo } from "../../lib/store";

// Data is loaded per request, scoped by the database to what this user may see.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const me = await serverApi<Me>(jar, "/v1/me");
  if (!me.ok) {
    if (me.status === 401) redirect("/login");
    return (
      <AuthLayout product="Dispatch" title="Service unavailable">
        <FormAlert>The TURVIO service is not reachable right now (HTTP {me.status}). Please try again in a moment.</FormAlert>
      </AuthLayout>
    );
  }
  const dispatchOrgs = me.data.memberships.filter((m) => can(m.role, "tours.view_all"));
  if (dispatchOrgs.length === 0) {
    const isDriver = me.data.memberships.some((m) => m.role === "driver");
    return (
      <AuthLayout product="Dispatch" title="No Dispatch access" footer={<SignOutButton />}>
        <FormAlert>
          {isDriver
            ? "Your account is a driver account. Use the TURVIO Driver app on your phone to see your tours."
            : me.data.platformAdmin
              ? "Platform administrators use TURVIO Admin. Dispatch is for the companies' own staff."
              : "Your account is not a member of any company yet. Ask your administrator for an invitation."}
        </FormAlert>
      </AuthLayout>
    );
  }
  const chosen = dispatchOrgs.find((m) => m.organizationId === jar.get(COOKIES.org)?.value) ?? dispatchOrgs[0]!;
  const data = await serverApi<DispatchDataset>(jar, `/v1/orgs/${chosen.organizationId}/dispatch`);
  if (!data.ok) {
    if (data.status === 401) redirect("/login");
    return (
      <AuthLayout product="Dispatch" title="Could not load your workspace" footer={<SignOutButton />}>
        <FormAlert>Loading {chosen.organizationName ?? "the company"} failed (HTTP {data.status}). Reload the page to try again.</FormAlert>
      </AuthLayout>
    );
  }
  const session: SessionInfo = {
    userName: me.data.name ?? me.data.email ?? "User",
    email: me.data.email ?? "",
    role: chosen.role,
    organizationId: chosen.organizationId,
    organizationName: chosen.organizationName ?? "",
    // Fail-closed: a dispatcher is company-wide only with an explicit all-locations grant.
    companyWide: chosen.role === "owner" || chosen.role === "admin" || !!chosen.allLocations,
    workspaces: dispatchOrgs.map((m) => ({ id: m.organizationId, name: m.organizationName ?? m.organizationId, role: m.role })),
    environment: process.env.NEXT_PUBLIC_TURVIO_ENV ?? null,
  };
  return (
    <DispatchProvider base={data.data} session={session}>
      <DispatchShell>{children}</DispatchShell>
    </DispatchProvider>
  );
}
