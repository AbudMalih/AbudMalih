import { z } from "zod";

// German fallback messages for any issue without a custom message.
z.config(z.locales.de());
// No runtime code generation (keeps the strict Content-Security-Policy intact).
z.config({ jitless: true });

/**
 * Form schemas shared by client (React Hook Form) and server (API routes).
 * Files are validated separately (see files.ts) because they travel as
 * multipart data.
 */

/** Applications address applicants with "du", business and contact forms with "Sie". */
export type Tone = "du" | "sie";

const req = (label: string) => z.string({ error: `Bitte ${label} angeben.` }).trim().min(1, { error: `Bitte ${label} angeben.` });
const yesNo = z.enum(["ja", "nein"], { error: "Bitte Ja oder Nein wählen." });
const phone = z
  .string({ error: "Bitte Telefonnummer angeben." })
  .trim()
  .min(1, { error: "Bitte Telefonnummer angeben." })
  .regex(/^[+()\d\s/-]{6,24}$/, { error: "Bitte eine gültige Telefonnummer angeben." });
const email = z
  .string({ error: "Bitte E-Mail-Adresse angeben." })
  .trim()
  .min(1, { error: "Bitte E-Mail-Adresse angeben." })
  .max(200)
  .pipe(z.email({ error: "Bitte eine gültige E-Mail-Adresse angeben." }));
const consent = (tone: Tone) =>
  z.boolean().refine((v) => v === true, { error: tone === "du" ? "Bitte stimme der Datenverarbeitung zu." : "Bitte stimmen Sie der Datenverarbeitung zu." });
/** Honeypot – must stay empty. */
const trap = z.string().max(0).optional();
const text = (label: string, max = 200) => req(label).max(max, { error: `Maximal ${max} Zeichen.` });
const optionalText = (max = 4000) => z.string().trim().max(max, { error: `Maximal ${max} Zeichen.` }).optional().or(z.literal(""));

export const quickApplySchema = z.object({
  firstName: text("deinen Vornamen", 100),
  lastName: text("deinen Nachnamen", 100),
  phone,
  email,
  city: text("deinen Wohnort", 120),
  position: text("eine Position", 200),
  location: text("einen Standort", 120),
  licenceB: yesNo,
  experience: yesNo,
  startDate: text("deinen frühesten Starttermin", 40),
  consent: consent("du"),
  website: trap,
});
export type QuickApplyValues = z.infer<typeof quickApplySchema>;

export const fullApplySchema = quickApplySchema.extend({
  workExperience: optionalText(),
  employers: optionalText(),
  qualifications: optionalText(),
  languages: optionalText(500),
  licences: z.array(z.string().max(10)).max(12).optional(),
  message: optionalText(),
});
export type FullApplyValues = z.infer<typeof fullApplySchema>;

export const businessSchema = z.object({
  company: text("das Unternehmen", 160),
  contactName: text("einen Ansprechpartner", 120),
  email,
  phone,
  projectLocation: text("den Projektstandort", 160),
  description: z.string().trim().min(20, { error: "Bitte beschreiben Sie das Projekt in mindestens 20 Zeichen." }).max(4000),
  serviceTypes: z.array(z.string().max(80)).min(1, { error: "Bitte wählen Sie mindestens eine Leistungsart." }).max(12),
  volume: optionalText(300),
  startDate: optionalText(100),
  vehicleNeed: text("den Fahrzeugbedarf", 60),
  message: optionalText(),
  consent: consent("sie"),
  website: trap,
});
export type BusinessValues = z.infer<typeof businessSchema>;

export const contactSchema = z.object({
  name: text("Ihren Namen", 120),
  email,
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  subject: text("einen Betreff", 160),
  message: z.string().trim().min(10, { error: "Bitte schreiben Sie uns mindestens 10 Zeichen." }).max(4000),
  consent: consent("sie"),
  website: trap,
});
export type ContactValues = z.infer<typeof contactSchema>;

export const applicationKinds = ["quick", "full", "initiative"] as const;
export type ApplicationKind = (typeof applicationKinds)[number];
