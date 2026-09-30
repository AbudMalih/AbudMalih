import { formatStartDate, getJob } from "@/content/jobs";
import { applicationKinds, fullApplySchema, quickApplySchema, type ApplicationKind, type FullApplyValues } from "@/lib/forms/schemas";
import { processSubmission } from "@/lib/forms/server";
import { applicantRetentionDays, recipients } from "@/lib/mail/config";
import { formatBerlin } from "@/lib/mail/templates";

export const runtime = "nodejs";

const KIND: Record<ApplicationKind, string> = { quick: "Kurzbewerbung", full: "Vollständige Bewerbung", initiative: "Initiativbewerbung" };

const kindOf = (f: Record<string, unknown>): ApplicationKind =>
  (applicationKinds as readonly string[]).includes(String(f.kind)) ? (f.kind as ApplicationKind) : "quick";

export async function POST(req: Request) {
  let kind: ApplicationKind = "quick";
  return processSubmission<FullApplyValues>({
    req,
    scope: "bewerbung",
    refPrefix: "B",
    schema: (fields) => {
      kind = kindOf(fields);
      return (kind === "quick" ? quickApplySchema : fullApplySchema) as never;
    },
    arrays: ["licences"],
    allowFiles: true,
    recipient: recipients.careers(),
    build: (v, { receivedAt }) => {
      const job = getJob(v.position);
      const position = job ? job.title : v.position;
      const name = `${v.firstName} ${v.lastName}`;
      const yn = (x: string) => (x === "ja" ? "Ja" : "Nein");
      const start = /^\d{4}-\d{2}-\d{2}$/.test(v.startDate) ? formatStartDate(v.startDate) : v.startDate;
      const days = applicantRetentionDays();
      const deleteBy = days ? formatBerlin(new Date(receivedAt.getTime() + days * 86_400_000)).slice(0, 10) : null;
      return {
        subject: `${KIND[kind]}: ${position} – ${name} (${v.location})`,
        replyTo: v.email,
        email: {
          kind: KIND[kind],
          headline: position,
          subline: job ? `${job.location} · ${job.employmentType}` : `Gewünschter Standort: ${v.location}`,
          contact: { name, email: v.email, phone: v.phone },
          sections: [
            {
              title: "Bewerbung",
              rows: [
                ["Art", KIND[kind]],
                ["Position", position],
                ["Stellenanzeige", job ? `${job.location}, ${job.employmentType}, Start: ${formatStartDate(job.startDate)}` : "Keine (initiativ / andere Position)"],
                ["Gewünschter Standort", v.location],
                ["Frühester Starttermin", start],
              ],
            },
            {
              title: "Person",
              rows: [
                ["Name", name],
                ["Telefon", v.phone],
                ["E-Mail", v.email],
                ["Wohnort", v.city],
              ],
            },
            {
              title: "Qualifikation",
              rows: [
                ["Führerschein Klasse B", yn(v.licenceB)],
                ["KEP- / Logistikerfahrung", yn(v.experience)],
                ["Weitere Führerscheinklassen", v.licences],
                ["Berufserfahrung", v.workExperience],
                ["Bisherige Arbeitgeber", v.employers],
                ["Qualifikationen", v.qualifications],
                ["Sprachen", v.languages],
              ],
            },
            { title: "Nachricht", rows: [["Nachricht", v.message]] },
          ],
          consentAt: receivedAt,
          privacyNote: deleteBy
            ? `Löschhinweis: Daten spätestens am ${deleteBy} löschen, sofern keine Einstellung erfolgt oder eine längere Speicherung vereinbart wurde.`
            : "Löschfrist gemäß Datenschutzerklärung beachten.",
        },
      };
    },
  });
}
