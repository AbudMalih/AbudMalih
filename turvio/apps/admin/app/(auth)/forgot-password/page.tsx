import { ForgotPasswordForm } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("shell.title.resetPassword") };
}

export default async function ForgotPage() {
  return <ForgotPasswordForm product={(await serverT()).t("shell.product")} />;
}
