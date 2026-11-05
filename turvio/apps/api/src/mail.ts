import nodemailer from "nodemailer";
import type { Db } from "./db";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Development: records mails in app_auth.outbox (readable via GET /v1/dev/outbox when DEV_MAILBOX=true). */
export class OutboxMailer implements Mailer {
  constructor(
    private readonly db: Db,
    private readonly log: (msg: string) => void = () => undefined,
  ) {}

  async send(mail: Mail) {
    await this.db.asService((tx) => tx.query(`insert into app_auth.outbox (to_email, subject, body) values ($1, $2, $3)`, [mail.to, mail.subject, mail.text]));
    this.log(`mail recorded in outbox for ${mail.to}: ${mail.subject}`);
  }
}

/** Production: any SMTP relay (e.g. an EU mail provider). */
export class SmtpMailer implements Mailer {
  private readonly transport: nodemailer.Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(mail: Mail) {
    await this.transport.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text });
  }
}
