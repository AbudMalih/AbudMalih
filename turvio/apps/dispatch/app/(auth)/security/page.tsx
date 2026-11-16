import { MfaSetupForm } from "@turvio/web-ui/ds";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata() {
  const { t } = await serverT();
  return { title: t("shell.title.security") };
}

/** Signed-in only (not in the public paths of the session proxy). */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ next?: string; required?: string }> }) {
  const { next, required } = await searchParams;
  return <MfaSetupForm product="Dispatch" next={next} required={required === "1"} />;
}
