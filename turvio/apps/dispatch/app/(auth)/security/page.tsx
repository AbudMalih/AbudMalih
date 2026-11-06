import { MfaSetupForm } from "@turvio/web-ui/ds";

export const metadata = { title: "Two-step verification" };

/** Signed-in only (not in the public paths of the session proxy). */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ next?: string; required?: string }> }) {
  const { next, required } = await searchParams;
  return <MfaSetupForm product="Dispatch" next={next} required={required === "1"} />;
}
