import { AcceptInviteForm } from "@turvio/web-ui/ds";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await serverT();
  return { title: t("shell.title.invite") };
}

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AcceptInviteForm product="Dispatch" token={token ?? null} />;
}
