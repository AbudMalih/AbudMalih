import { LoginForm } from "@turvio/web-ui/ds";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await serverT();
  return { title: t("shell.title.signIn") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm product="Dispatch" next={next} />;
}
