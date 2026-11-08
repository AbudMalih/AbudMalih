/**
 * Contact inquiry: shared shape and validation (used by the form on the
 * client AND, authoritatively, by the server route). Messages are keys;
 * the copy lives in content/i18n/contact.
 */
export const INQUIRY_TYPES = [
  "business",
  "brand",
  "supplier",
  "general",
] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export type Inquiry = {
  name: string;
  company: string;
  email: string;
  type: InquiryType;
  message: string;
};
export type FieldError = "required" | "email" | "long" | "short";
export type Errors = Partial<Record<keyof Inquiry, FieldError>>;

export const LIMITS = {
  name: 120,
  company: 160,
  email: 254,
  message: 5000,
  messageMin: 10,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* single-line fields (they also reach the e-mail subject): no control
   characters at all, so nothing can break a header line */
const oneLine = (v: string) =>
  v
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
/* the message keeps its line breaks and tabs, nothing else */
const multiLine = (v: string) =>
  v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, "")
    .trim();

export function normalise(
  raw: Partial<Record<keyof Inquiry, unknown>>,
): Inquiry {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const type = INQUIRY_TYPES.includes(raw.type as InquiryType)
    ? (raw.type as InquiryType)
    : "general";
  return {
    name: oneLine(s(raw.name)),
    company: oneLine(s(raw.company)),
    email: s(raw.email).trim(),
    type,
    message: multiLine(s(raw.message)),
  };
}

export function validate(q: Inquiry): Errors {
  const e: Errors = {};
  if (!q.name) e.name = "required";
  else if (q.name.length > LIMITS.name) e.name = "long";
  if (q.company.length > LIMITS.company) e.company = "long";
  if (!q.email) e.email = "required";
  else if (q.email.length > LIMITS.email || !EMAIL.test(q.email))
    e.email = "email";
  if (!q.message) e.message = "required";
  else if (q.message.length < LIMITS.messageMin) e.message = "short";
  else if (q.message.length > LIMITS.message) e.message = "long";
  return e;
}
