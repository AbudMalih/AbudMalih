import { businessSchema, type BusinessValues } from "@/lib/forms/schemas";
import { processSubmission } from "@/lib/forms/server";
import { recipients } from "@/lib/mail/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return processSubmission<BusinessValues>({
    req,
    scope: "anfrage",
    refPrefix: "A",
    schema: businessSchema as never,
    arrays: ["serviceTypes"],
    allowFiles: true,
    recipient: recipients.business(),
    build: (v, { receivedAt }) => ({
      subject: `Projektanfrage: ${v.company} – ${v.projectLocation}`,
      replyTo: v.email,
      email: {
        kind: "Geschäftsanfrage",
        headline: v.company,
        subline: `Projektstandort: ${v.projectLocation}`,
        contact: { name: v.contactName, email: v.email, phone: v.phone },
        sections: [
          {
            title: "Projekt",
            rows: [
              ["Unternehmen", v.company],
              ["Ansprechpartner", v.contactName],
              ["Projektstandort", v.projectLocation],
              ["Leistungsart", v.serviceTypes],
              ["Erwartetes Volumen", v.volume],
              ["Gewünschter Start", v.startDate],
              ["Fahrzeugbedarf", v.vehicleNeed],
            ],
          },
          { title: "Beschreibung", rows: [["Projektbeschreibung", v.description], ["Nachricht", v.message]] },
        ],
        consentAt: receivedAt,
      },
    }),
  });
}
