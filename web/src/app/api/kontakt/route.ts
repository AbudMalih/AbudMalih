import { contactSchema, type ContactValues } from "@/lib/forms/schemas";
import { processSubmission } from "@/lib/forms/server";
import { recipients } from "@/lib/mail/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return processSubmission<ContactValues>({
    req,
    scope: "kontakt",
    refPrefix: "K",
    schema: contactSchema as never,
    allowFiles: false,
    recipient: recipients.general(),
    build: (v, { receivedAt }) => ({
      subject: `Kontaktanfrage: ${v.subject}`,
      replyTo: v.email,
      email: {
        kind: "Allgemeiner Kontakt",
        headline: v.subject,
        contact: { name: v.name, email: v.email, phone: v.phone || null },
        sections: [{ title: "Nachricht", rows: [["Betreff", v.subject], ["Nachricht", v.message]] }],
        consentAt: receivedAt,
      },
    }),
  });
}
