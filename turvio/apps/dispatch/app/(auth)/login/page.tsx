import { LoginForm } from "@turvio/web-ui/ds";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm product="Dispatch" next={next} />;
}
