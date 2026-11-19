import type { Metadata } from "next";
import { PlatformAdmins } from "../../../components/PlatformAdmins";
import { serverT } from "../../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await serverT()).t("admins.title") };
}
export const dynamic = "force-dynamic";

export default function AdminsPage() {
  return <PlatformAdmins />;
}
