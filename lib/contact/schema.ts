/**
 * Contact inquiry: shared shape and validation (used by the form on the
 * client AND, authoritatively, by the server route). Messages are keys;
 * the copy lives in content/i18n/contact.
 */
export const INQUIRY_TYPES = ["business", "brand", "supplier", "general"] as const;
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

export const LIMITS = { name: 120, company: 160, email: 254, message: 5000, messageMin: 10 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalise(raw: Partial<Record<keyof Inquiry, unknown>>): Inquiry {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const type = INQUIRY_TYPES.includes(raw.type as InquiryType) ? (raw.type as InquiryType) : "general";
  return {
    name: s(raw.name),
    company: s(raw.company),
    email: s(raw.email),
    type,
    message: s(raw.message),
  };
}

export function validate(q: Inquiry): Errors {
  const e: Errors = {};
  if (!q.name) e.name = "required";
  else if (q.name.length > LIMITS.name) e.name = "long";
  if (q.company.length > LIMITS.company) e.company = "long";
  if (!q.email) e.email = "required";
  else if (q.email.length > LIMITS.email || !EMAIL.test(q.email)) e.email = "email";
  if (!q.message) e.message = "required";
  else if (q.message.length < LIMITS.messageMin) e.message = "short";
  else if (q.message.length > LIMITS.message) e.message = "long";
  return e;
}
