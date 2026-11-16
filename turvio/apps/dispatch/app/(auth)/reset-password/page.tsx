import { ResetPasswordForm } from "@turvio/web-ui/ds";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await serverT();
  return { title: t("shell.title.newPassword") };
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm product="Dispatch" token={token ?? null} />;
}
