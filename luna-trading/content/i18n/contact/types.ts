import type { InquiryType, FieldError } from "@/lib/contact/schema";

export type ContactCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; h1a: string; h1b: string; lead: string; you: string; luna: string };
  direct: { tag: string; title: string; note: string; reply: string };
  inquiry: { tag: string; title: string; typeLegend: string; types: Record<InquiryType, string> };
  fields: {
    name: string;
    company: string;
    email: string;
    website: string;
    message: string;
    optional: string;
    required: string;
    hint: { default: string; supplier: string };
  };
  errors: Record<FieldError, string> & { summary: string; messageRequired: string; nameRequired: string; emailRequired: string };
  privacy: { text: string; link: string };
  submit: { idle: string; sending: string };
  failure: { title: string; text: string; retry: string; rate: string };
  success: { tag: string; h1: string; h2: string; text: string; again: string };
  closing: { line: string };
};
