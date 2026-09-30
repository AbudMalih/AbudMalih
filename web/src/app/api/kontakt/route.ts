import { contactSchema } from "@/lib/forms/schemas";
import { clientIp, fieldsOf, json, lines, rateLimited, reference } from "@/lib/forms/server";
import { getMailer, recipients } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (rateLimited(`kontakt:${clientIp(req)}`)) {
    return json({ ok: false, code: "rate_limited", error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }, 429);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid", error: "Ungültige Anfrage." }, 400);
  }
  const parsed = contactSchema.safeParse(fieldsOf(form));
  if (!parsed.success) return json({ ok: false, code: "invalid", error: parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Angaben." }, 400);
  const v = parsed.data;
  if (v.website) return json({ ok: true, reference: reference("K") });

  const mailer = getMailer();
  const to = recipients.general();
  if (!mailer || !to) {
    return json({ ok: false, code: "not_configured", error: "Der Online-Versand für allgemeine Anfragen ist noch nicht aktiviert." }, 503);
  }
  const ref = reference("K");
  try {
    await mailer.send({
      to,
      replyTo: v.email,
      subject: `Kontaktanfrage: ${v.subject}`,
      text: [
        `Kontaktanfrage über jarbou-logistik.com – Referenz ${ref}`,
        "",
        lines([
          ["Name", v.name],
          ["E-Mail", v.email],
          ["Telefon", v.phone],
          ["Betreff", v.subject],
          ["Nachricht", v.message],
        ]),
        "Einwilligung zur Datenverarbeitung: erteilt",
      ].join("\n"),
    });
  } catch (e) {
    console.error("[kontakt] Versand fehlgeschlagen", e);
    return json({ ok: false, code: "failed", error: "Die Nachricht konnte nicht versendet werden. Bitte versuchen Sie es erneut." }, 502);
  }
  return json({ ok: true, reference: ref });
}
