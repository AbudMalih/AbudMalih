/**
 * Invitation e-mails in the company's language (organizations.default_locale: de, en, ro, ar).
 * Plain text; the link is the only variable part besides names.
 */
export type MailLocale = "de" | "en" | "ro" | "ar";

const ROLE: Record<MailLocale, Record<string, string>> = {
  en: { owner: "Owner", admin: "Company Admin", dispatcher: "Dispatcher", driver: "Driver" },
  de: { owner: "Inhaber", admin: "Unternehmensadmin", dispatcher: "Disponent", driver: "Fahrer" },
  ro: { owner: "Proprietar", admin: "Administrator companie", dispatcher: "Dispecer", driver: "Șofer" },
  ar: { owner: "المالك", admin: "مسؤول الشركة", dispatcher: "مُرسِل", driver: "سائق" },
};

export function mailLocale(v: unknown): MailLocale {
  return v === "de" || v === "ro" || v === "ar" ? v : "en";
}

export function invitationMail(o: { locale: MailLocale; orgName: string; role: string; link: string; reminder?: boolean }): { subject: string; text: string } {
  const role = ROLE[o.locale][o.role] ?? o.role;
  const driver = o.role === "driver";
  switch (o.locale) {
    case "de":
      return {
        subject: `${o.reminder ? "Erinnerung: " : ""}Einladung zu ${o.orgName} auf TURVIO`,
        text: `${o.orgName} hat Sie als ${role} zu TURVIO eingeladen.\n\nEinladung annehmen (7 Tage gültig):\n${o.link}\n\n${driver ? "Melden Sie sich danach mit derselben E-Mail-Adresse und demselben Passwort in der App TURVIO Driver an.\n" : ""}`,
      };
    case "ro":
      return {
        subject: `${o.reminder ? "Memento: " : ""}Invitație la ${o.orgName} pe TURVIO`,
        text: `${o.orgName} v-a invitat în TURVIO ca ${role}.\n\nAcceptați invitația (valabilă 7 zile):\n${o.link}\n\n${driver ? "Apoi conectați-vă în aplicația TURVIO Driver cu același e-mail și aceeași parolă.\n" : ""}`,
      };
    case "ar":
      return {
        subject: `${o.reminder ? "تذكير: " : ""}دعوة للانضمام إلى ${o.orgName} على TURVIO`,
        text: `دعتك ${o.orgName} إلى TURVIO بصفة ${role}.\n\nاقبل الدعوة (صالحة لمدة 7 أيام):\n${o.link}\n\n${driver ? "بعد ذلك سجّل الدخول في تطبيق TURVIO Driver بنفس البريد الإلكتروني وكلمة المرور.\n" : ""}`,
      };
    default:
      return {
        subject: `${o.reminder ? "Reminder: " : ""}You are invited to ${o.orgName} on TURVIO`,
        text: `${o.orgName} invited you to TURVIO as ${role}.\n\nAccept the invitation (valid for 7 days):\n${o.link}\n\n${driver ? "After accepting, sign in with the same email and password in the TURVIO Driver app.\n" : ""}`,
      };
  }
}
