import { getJob, formatStartDate } from "@/content/jobs";
import { applicationKinds, fullApplySchema, quickApplySchema, type ApplicationKind } from "@/lib/forms/schemas";
import { clientIp, fieldsOf, json, lines, rateLimited, readFiles, reference } from "@/lib/forms/server";
import { applicantRetentionDays, getMailer, recipients } from "@/lib/mail";

export const runtime = "nodejs";

const KIND_LABEL: Record<ApplicationKind, string> = {
  quick: "Kurzbewerbung",
  full: "Vollständige Bewerbung",
  initiative: "Initiativbewerbung",
};

export async function POST(req: Request) {
  if (rateLimited(`bewerbung:${clientIp(req)}`)) {
    return json({ ok: false, code: "rate_limited", error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }, 429);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid", error: "Ungültige Anfrage." }, 400);
  }
  const kind = (applicationKinds as readonly string[]).includes(String(form.get("kind"))) ? (form.get("kind") as ApplicationKind) : "quick";
  const schema = kind === "quick" ? quickApplySchema : fullApplySchema;
  const parsed = schema.safeParse(fieldsOf(form, ["licences"]));
  if (!parsed.success) {
    return json({ ok: false, code: "invalid", error: parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Angaben." }, 400);
  }
  const v = parsed.data as Record<string, string | string[] | boolean | undefined>;
  if (v.website) return json({ ok: true, reference: reference("B") }); // honeypot: silently accept

  const { files, error } = await readFiles(form);
  if (error) return json({ ok: false, code: "invalid", error }, 400);

  const mailer = getMailer();
  if (!mailer) {
    return json(
      { ok: false, code: "not_configured", error: "Der Online-Versand ist noch nicht aktiviert. Bitte senden Sie Ihre Bewerbung per E-Mail." },
      503,
    );
  }

  const job = typeof v.position === "string" ? getJob(v.position) : undefined;
  const positionLabel = job ? `${job.title}, ${job.location}` : String(v.position);
  const ref = reference("B");
  const deleteBy = new Date(Date.now() + applicantRetentionDays() * 86400000).toLocaleDateString("de-DE");
  const yn = (x: unknown) => (x === "ja" ? "Ja" : "Nein");

  const text = [
    `${KIND_LABEL[kind]} über jarbou-logistik.com – Referenz ${ref}`,
    "",
    lines([
      ["Position", positionLabel],
      ["Gewünschter Standort", v.location as string],
      ["Name", `${v.firstName} ${v.lastName}`],
      ["Telefon", v.phone as string],
      ["E-Mail", v.email as string],
      ["Wohnort", v.city as string],
      ["Führerschein Klasse B", yn(v.licenceB)],
      ["KEP-/Logistikerfahrung", yn(v.experience)],
      ["Frühester Starttermin", /^\d{4}-\d{2}-\d{2}$/.test(String(v.startDate)) ? formatStartDate(String(v.startDate)) : (v.startDate as string)],
      ["Berufserfahrung", v.workExperience as string],
      ["Bisherige Arbeitgeber", v.employers as string],
      ["Qualifikationen", v.qualifications as string],
      ["Sprachen", v.languages as string],
      ["Weitere Führerscheinklassen", v.licences as string[]],
      ["Nachricht", v.message as string],
      ["Anhänge", files.map((f) => f.filename)],
    ]),
    "Einwilligung zur Datenverarbeitung: erteilt",
    `Datenschutz: Bewerberdaten bitte bis spätestens ${deleteBy} löschen, sofern keine Einstellung erfolgt oder eine längere Speicherung vereinbart wurde.`,
  ].join("\n");

  try {
    await mailer.send({
      to: recipients.careers(),
      replyTo: v.email as string,
      subject: `${KIND_LABEL[kind]}: ${job ? job.title : v.position} – ${v.firstName} ${v.lastName} (${v.location})`,
      text,
      attachments: files,
    });
  } catch (e) {
    console.error("[bewerbung] Versand fehlgeschlagen", e);
    return json({ ok: false, code: "failed", error: "Die Bewerbung konnte nicht versendet werden. Bitte versuchen Sie es erneut oder schreiben Sie uns per E-Mail." }, 502);
  }
  return json({ ok: true, reference: ref });
}
