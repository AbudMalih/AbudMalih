import { LoginForm } from "@turvio/web-ui/ds";
import type { Metadata } from "next";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("shell.title.signIn") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm product={(await serverT()).t("shell.product")} next={next} />;
}
