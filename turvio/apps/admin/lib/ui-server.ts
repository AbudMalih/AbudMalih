import { cookies } from "next/headers";

/** Phase G (default) unless this browser chose the classic design (`?ui=classic`, see lib/ui.tsx). */
export async function isDesignG(): Promise<boolean> {
  return (await cookies()).get("tv_ui")?.value !== "classic";
}
