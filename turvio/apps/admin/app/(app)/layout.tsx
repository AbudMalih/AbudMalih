import { AuthLayout, FormAlert } from "@turvio/web-ui/ds";
import { serverApi, type Me } from "@turvio/web-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../components/AdminShell";
import { SignOutLink } from "../../components/SignOutLink";
import { serverT } from "../../lib/i18n/server";
import { AdminSessionProvider } from "../../lib/session";

export const dynamic = "force-dynamic";

/** TURVIO Admin is for platform operators only (public.platform_admins). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await serverApi<Me>(await cookies(), "/v1/me");
  const { t } = await serverT();
  if (!me.ok) {
    if (me.status === 401) redirect("/login");
    return (
      <AuthLayout product={t("shell.product")} title={t("shell.serviceUnavailable")}>
        <FormAlert>{t("shell.serviceUnavailableBody")}</FormAlert>
      </AuthLayout>
    );
  }
  if (!me.data.platformAdmin) {
    return (
      <AuthLayout product={t("shell.product")} title={t("shell.noAccess")} footer={<SignOutLink />}>
        <FormAlert>{t("shell.noAccessBody")}</FormAlert>
      </AuthLayout>
    );
  }
  return (
    <AdminSessionProvider value={{ name: me.data.name ?? me.data.email ?? t("shell.role"), email: me.data.email ?? "", environment: process.env.NEXT_PUBLIC_TURVIO_ENV ?? null }}>
      {/* The shell is mounted once here and persists across pages; only the content area changes. */}
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
