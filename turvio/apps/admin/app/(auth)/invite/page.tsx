import { AcceptInviteForm } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("shell.title.invite") };
}

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AcceptInviteForm product={(await serverT()).t("shell.product")} token={token ?? null} />;
}
