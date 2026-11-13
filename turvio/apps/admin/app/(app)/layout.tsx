import { AuthLayout, FormAlert } from "@turvio/web-ui/ds";
import { serverApi, type Me } from "@turvio/web-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../components/AdminShell";
import { SignOutLink } from "../../components/SignOutLink";
import { AdminSessionProvider } from "../../lib/session";

export const dynamic = "force-dynamic";

/** TURVIO Admin is for platform operators only (public.platform_admins). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await serverApi<Me>(await cookies(), "/v1/me");
  if (!me.ok) {
    if (me.status === 401) redirect("/login");
    return (
      <AuthLayout product="Platform Admin" title="Service unavailable">
        <FormAlert>The TURVIO service is not reachable right now (HTTP {me.status}).</FormAlert>
      </AuthLayout>
    );
  }
  if (!me.data.platformAdmin) {
    return (
      <AuthLayout product="Platform Admin" title="No access" footer={<SignOutLink />}>
        <FormAlert>TURVIO Admin is only for platform administrators. Company staff use TURVIO Dispatch.</FormAlert>
      </AuthLayout>
    );
  }
  return (
    <AdminSessionProvider value={{ name: me.data.name ?? me.data.email ?? "Platform admin", email: me.data.email ?? "", environment: process.env.NEXT_PUBLIC_TURVIO_ENV ?? null }}>
      {/* The shell is mounted once here and persists across pages; only the content area changes. */}
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
