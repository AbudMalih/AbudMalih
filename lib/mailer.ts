import nodemailer from 'nodemailer'

export interface MailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export interface MailOptions {
  to: string
  subject: string
  text: string
  replyTo?: string
  attachments?: MailAttachment[]
}

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.MAIL_FROM)
}

/**
 * Sends an email via the SMTP server configured through environment variables
 * (see .env.example). In development without SMTP configuration, submissions
 * are logged to the server console instead so the flow can be tested end-to-end.
 * In production, missing SMTP configuration is a hard error so submissions are
 * never silently dropped.
 */
export async function sendMail(options: MailOptions): Promise<void> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP ist nicht konfiguriert (SMTP_HOST, SMTP_PORT, MAIL_FROM erforderlich)')
    }
    console.warn('[mailer] SMTP nicht konfiguriert – E-Mail wird nur geloggt (Entwicklungsmodus).')
    console.info('[mailer] An:', options.to)
    console.info('[mailer] Betreff:', options.subject)
    console.info('[mailer] Inhalt:\n', options.text)
    console.info('[mailer] Anhänge:', options.attachments?.map(a => a.filename).join(', ') || 'keine')
    return
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    replyTo: options.replyTo,
    attachments: options.attachments,
  })
}
