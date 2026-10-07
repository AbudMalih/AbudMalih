/**
 * Contact inquiry: shared shape and validation (used by the form on the
 * client AND, authoritatively, by the server route). Messages are keys;
 * the copy lives in content/i18n/contact.
 */
export const INQUIRY_TYPES = ["trade", "development", "brand", "ecommerce", "distribution", "supplier", "general"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];
/** The website field is offered where a company site gives real context. */
export const WEBSITE_TYPES: InquiryType[] = ["supplier", "trade"];

export type Inquiry = {
  name: string;
  company: string;
  email: string;
  type: InquiryType;
  website: string;
  message: string;
};
export type FieldError = "required" | "email" | "url" | "long" | "short";
export type Errors = Partial<Record<keyof Inquiry, FieldError>>;

export const LIMITS = { name: 120, company: 160, email: 254, website: 200, message: 5000, messageMin: 10 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URLISH = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export function normalise(raw: Partial<Record<keyof Inquiry, unknown>>): Inquiry {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const type = INQUIRY_TYPES.includes(raw.type as InquiryType) ? (raw.type as InquiryType) : "general";
  return {
    name: s(raw.name),
    company: s(raw.company),
    email: s(raw.email),
    type,
    website: WEBSITE_TYPES.includes(type) ? s(raw.website) : "",
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
  if (q.website && (q.website.length > LIMITS.website || !URLISH.test(q.website))) e.website = "url";
  if (!q.message) e.message = "required";
  else if (q.message.length < LIMITS.messageMin) e.message = "short";
  else if (q.message.length > LIMITS.message) e.message = "long";
  return e;
}
