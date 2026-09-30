import { businessSchema } from "@/lib/forms/schemas";
import { clientIp, fieldsOf, json, lines, rateLimited, readFiles, reference } from "@/lib/forms/server";
import { getMailer, recipients } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (rateLimited(`anfrage:${clientIp(req)}`)) {
    return json({ ok: false, code: "rate_limited", error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }, 429);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid", error: "Ungültige Anfrage." }, 400);
  }
  const parsed = businessSchema.safeParse(fieldsOf(form, ["serviceTypes"]));
  if (!parsed.success) return json({ ok: false, code: "invalid", error: parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Angaben." }, 400);
  const v = parsed.data;
  if (v.website) return json({ ok: true, reference: reference("A") });

  const { files, error } = await readFiles(form);
  if (error) return json({ ok: false, code: "invalid", error }, 400);

  const mailer = getMailer();
  const to = recipients.business();
  if (!mailer || !to) {
    return json({ ok: false, code: "not_configured", error: "Der Online-Versand für Geschäftsanfragen ist noch nicht aktiviert." }, 503);
  }
  const ref = reference("A");
  try {
    await mailer.send({
      to,
      replyTo: v.email,
      subject: `Projektanfrage: ${v.company} – ${v.projectLocation}`,
      text: [
        `Projektanfrage über jarbou-logistik.com – Referenz ${ref}`,
        "",
        lines([
          ["Unternehmen", v.company],
          ["Ansprechpartner", v.contactName],
          ["E-Mail", v.email],
          ["Telefon", v.phone],
          ["Projektstandort", v.projectLocation],
          ["Leistungsart", v.serviceTypes],
          ["Erwartetes Volumen", v.volume],
          ["Gewünschter Start", v.startDate],
          ["Fahrzeugbedarf", v.vehicleNeed],
          ["Projektbeschreibung", v.description],
          ["Nachricht", v.message],
          ["Anhänge", files.map((f) => f.filename)],
        ]),
        "Einwilligung zur Datenverarbeitung: erteilt",
      ].join("\n"),
      attachments: files,
    });
  } catch (e) {
    console.error("[geschaeftsanfrage] Versand fehlgeschlagen", e);
    return json({ ok: false, code: "failed", error: "Die Anfrage konnte nicht versendet werden. Bitte versuchen Sie es erneut." }, 502);
  }
  return json({ ok: true, reference: ref });
}
