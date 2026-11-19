import { ResetPasswordForm } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("shell.title.newPassword") };
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm product={(await serverT()).t("shell.product")} token={token ?? null} />;
}
