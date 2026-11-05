import { ResetPasswordForm } from "@turvio/web-ui/ds";

export const metadata = { title: "New password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm product="Platform Admin" token={token ?? null} />;
}
