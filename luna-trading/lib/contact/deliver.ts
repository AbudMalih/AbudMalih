// Server-only module: imported solely by the API routes (contact, quote).
import nodemailer from "nodemailer";
import type { Inquiry, InquiryType } from "./schema";
import { CONTACT_EMAIL } from "@/content/site";

/**
 * Delivery of a validated inquiry to the company inbox through the company's
 * own mail provider (authenticated SMTP, TLS mandatory).
 *
 * Configuration comes ONLY from server-side environment variables (Vercel →
 * Project → Settings → Environment Variables; never NEXT_PUBLIC_*):
 *   SMTP_HOST    the provider's SMTP host, exactly as the provider documents it
 *   SMTP_PORT    465 (implicit TLS) or 587 (STARTTLS, required here)
 *   SMTP_USER    the mailbox / sending account used to authenticate
 *   SMTP_PASS    its password (or app password)
 *   MAIL_FROM    the authenticated sender address (defaults to SMTP_USER)
 * Without them, delivery reports "not_configured" and the route answers 503,
 * so the visitor sees an honest failure with the direct address, never a
 * fake success.
 *
 * Fixed recipient. The visitor's (validated, single-line) address is used
 * only as Reply-To; no visitor input can add recipients or headers.
 */
export const RECIPIENT = CONTACT_EMAIL;

export type DeliveryResult = { ok: true } | { ok: false; reason: "not_configured" | "failed" };

/** German labels: the inbox works in the company language. */
const TYPE_LABEL: Record<InquiryType, string> = {
  business: "Geschäft & Beschaffung",
  brand: "Marke & Produkt",
  supplier: "Lieferant / Hersteller",
  general: "Allgemeine Anfrage",
};

function config() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = (process.env.MAIL_FROM || user || "").trim();
  if (!host || !port || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

export function isConfigured() {
  return config() !== null;
}

/** Send one plain-text message to the fixed company inbox (Reply-To: the visitor). */
export async function sendToInbox(mail: { subject: string; text: string; replyTo: { name: string; address: string } }): Promise<DeliveryResult> {
  const c = config();
  if (!c) return { ok: false, reason: "not_configured" };
  const implicitTls = c.port === 465;
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: implicitTls, // 465: TLS from the first byte
    requireTLS: !implicitTls, // 587: STARTTLS is mandatory, never plain text
    auth: { user: c.user, pass: c.pass },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    const info = await transport.sendMail({
      from: { name: "Luna Trading Website", address: c.from },
      to: RECIPIENT,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    // success only when the server accepted the fixed recipient
    const accepted = (info.accepted ?? []).map(String).map((a) => a.toLowerCase());
    if (accepted.includes(RECIPIENT.toLowerCase()) && !(info.rejected ?? []).length) return { ok: true };
    console.error("[contact] SMTP did not accept the recipient");
    return { ok: false, reason: "failed" };
  } catch (err) {
    // log only a classification, never credentials, message content or addresses
    const e = err as { code?: string; responseCode?: number };
    console.error(`[contact] SMTP delivery failed (${e.code ?? "error"}${e.responseCode ? ` ${e.responseCode}` : ""})`);
    return { ok: false, reason: "failed" };
  } finally {
    transport.close();
  }
}

export async function deliver(inquiry: Inquiry, meta: { locale: string }): Promise<DeliveryResult> {
  const type = TYPE_LABEL[inquiry.type];
  const subject = `[Luna Trading Website] ${type} — ${inquiry.company || inquiry.name}`;
  const text = [
    "Neue Anfrage über das Kontaktformular auf luna-trading.de",
    "",
    `Name:          ${inquiry.name}`,
    `Unternehmen:   ${inquiry.company || "–"}`,
    `E-Mail:        ${inquiry.email}`,
    `Art:           ${type}`,
    `Sprache:       ${meta.locale.toUpperCase()}`,
    "",
    "Nachricht:",
    inquiry.message,
    "",
    "–",
    "Antworten Sie direkt auf diese E-Mail, um der anfragenden Person zu schreiben.",
  ].join("\n");

  return sendToInbox({ subject, text, replyTo: { name: inquiry.name, address: inquiry.email } });
}
