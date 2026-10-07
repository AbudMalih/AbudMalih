// Server-only module: imported solely by app/api/contact/route.ts.
import type { Inquiry } from "./schema";
import { CONTACT_EMAIL } from "@/content/site";

/**
 * Delivery of a validated inquiry to the company inbox.
 *
 * NOT CONNECTED YET. No mail provider, SMTP account or API key exists in
 * this project, so delivery reports "not_configured" and the route answers
 * 503: the visitor sees an honest failure with the direct e-mail address,
 * never a fake success. To connect at launch, implement one transport here
 * (server-side only, credentials from environment variables, never from the
 * client) and keep the recipient fixed below.
 */
export const RECIPIENT = CONTACT_EMAIL;

export type DeliveryResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

export async function deliver(inquiry: Inquiry, meta: { locale: string }): Promise<DeliveryResult> {
  void inquiry;
  void meta;
  return { ok: false, reason: "not_configured" };
}
