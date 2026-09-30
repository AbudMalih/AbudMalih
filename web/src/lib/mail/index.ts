import "server-only";
import { mailConfig } from "./config";

/**
 * Mail adapter.
 *  - SMTP (production): used when SMTP_HOST, SMTP_USER, SMTP_PASSWORD and
 *    SMTP_FROM are set. Works with one.com (send.one.com:465, SSL).
 *  - "log" (development only, MAIL_DRIVER=log): nothing is sent; an HTML
 *    preview is written to the OS temp folder. Refused in production.
 * Without configuration `getMailer()` returns null and the API answers 503.
 */
export type MailAttachment = { filename: string; content: Buffer; contentType: string };
export type MailMessage = { to: string; replyTo?: string; subject: string; text: string; html: string; attachments?: MailAttachment[] };
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

type Transport = { sendMail(opts: Record<string, unknown>): Promise<unknown> };
let transport: Transport | null = null;

export function getMailer(): Mailer | null {
  if (mailConfig.driver() === "log") {
    if (process.env.NODE_ENV === "production") return null;
    return {
      async send(m) {
        const [{ mkdir, writeFile }, { tmpdir }, { join }] = await Promise.all([import("node:fs/promises"), import("node:os"), import("node:path")]);
        const dir = join(tmpdir(), "jarbou-mail-preview");
        await mkdir(dir, { recursive: true });
        const file = join(dir, `${Date.now()}.html`);
        await writeFile(file, m.html, "utf8");
        // Metadata only – no applicant data in the console.
        console.info(`[mail:log] not sent (development). to=${m.to} attachments=${m.attachments?.length ?? 0} preview=${file}`);
      },
    };
  }
  const host = mailConfig.host();
  const user = mailConfig.user();
  const pass = mailConfig.password();
  const from = mailConfig.from();
  if (!host || !user || !pass || !from) return null;
  return {
    async send(m) {
      if (!transport) {
        const nodemailer = await import("nodemailer");
        transport = nodemailer.createTransport({
          host,
          port: mailConfig.port(),
          secure: mailConfig.secure(),
          auth: { user, pass },
          connectionTimeout: 15_000,
          greetingTimeout: 10_000,
          socketTimeout: 30_000,
        }) as unknown as Transport;
      }
      await transport.sendMail({
        from,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        text: m.text,
        html: m.html,
        attachments: m.attachments,
        disableUrlAccess: true,
        disableFileAccess: true,
      });
    },
  };
}
