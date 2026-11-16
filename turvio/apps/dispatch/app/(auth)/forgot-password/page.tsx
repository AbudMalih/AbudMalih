import { ForgotPasswordForm } from "@turvio/web-ui/ds";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await serverT();
  return { title: t("shell.title.resetPassword") };
}

export default function ForgotPage() {
  return <ForgotPasswordForm product="Dispatch" />;
}
