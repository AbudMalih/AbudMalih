import "server-only";

/**
 * Mail adapter.
 *
 * Provider-agnostic interface with two drivers:
 *  - "smtp": real delivery via nodemailer (any SMTP provider: IONOS, Microsoft
 *    365, Google Workspace, Mailjet, Brevo, Postmark SMTP, …)
 *  - "log":  development only – prints the message to the server console.
 *    Refused in production so the site never pretends mail was delivered.
 *
 * Without configuration `getMailer()` returns null and the API routes answer
 * with 503 + an honest message. See README → "E-Mail-Versand".
 */
export type MailAttachment = { filename: string; content: Buffer; contentType: string };
export type MailMessage = { to: string; replyTo?: string; subject: string; text: string; attachments?: MailAttachment[] };
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

export function getMailer(): Mailer | null {
  const driver = env("MAIL_DRIVER");
  if (driver === "log") {
    if (process.env.NODE_ENV === "production") return null;
    return {
      async send(m) {
        console.info("[mail:log] (nicht versendet – nur Entwicklung)", {
          to: m.to,
          subject: m.subject,
          attachments: m.attachments?.map((a) => `${a.filename} (${a.content.length} B)`),
        });
        console.info(m.text);
      },
    };
  }
  if (driver === "smtp") {
    const host = env("SMTP_HOST");
    const from = env("MAIL_FROM");
    if (!host || !from) return null;
    return {
      async send(m) {
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport({
          host,
          port: Number(env("SMTP_PORT") ?? 587),
          secure: env("SMTP_SECURE") === "true",
          auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
        });
        await transport.sendMail({
          from,
          to: m.to,
          replyTo: m.replyTo,
          subject: m.subject,
          text: m.text,
          attachments: m.attachments,
        });
      },
    };
  }
  return null;
}

/** Recipients. Careers has a confirmed default; the others must be configured. */
export const recipients = {
  careers: () => env("MAIL_TO_CAREERS") ?? "karriere@jarbou-logistik.com",
  business: () => env("MAIL_TO_BUSINESS") ?? null,
  general: () => env("MAIL_TO_GENERAL") ?? null,
};

/** Days after which applicant data should be deleted if no hire follows. */
export const applicantRetentionDays = () => Number(env("APPLICANT_RETENTION_DAYS") ?? 180);
