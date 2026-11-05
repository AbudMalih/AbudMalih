import { AcceptInviteForm } from "@turvio/web-ui/ds";

export const metadata = { title: "Accept invitation" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AcceptInviteForm product="Platform Admin" token={token ?? null} />;
}
