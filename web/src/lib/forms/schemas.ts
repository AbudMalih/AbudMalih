import { z } from "zod";

// German fallback messages for any issue without a custom message.
z.config(z.locales.de());

/**
 * Form schemas shared by client (React Hook Form) and server (API routes).
 * Files are validated separately (see files.ts) because they travel as
 * multipart data.
 */

const req = (label: string) => z.string().trim().min(1, { error: `Bitte ${label} angeben.` });
const yesNo = z.enum(["ja", "nein"], { error: "Bitte Ja oder Nein wählen." });
const phone = z
  .string()
  .trim()
  .min(1, { error: "Bitte Telefonnummer angeben." })
  .regex(/^[+()\d\s/-]{6,24}$/, { error: "Bitte eine gültige Telefonnummer angeben." });
const email = z.string().trim().min(1, { error: "Bitte E-Mail-Adresse angeben." }).pipe(z.email({ error: "Bitte eine gültige E-Mail-Adresse angeben." }));
const consent = z.boolean().refine((v) => v === true, { error: "Bitte stimmen Sie der Datenverarbeitung zu." });
/** Honeypot – must stay empty. */
const trap = z.string().max(0).optional();
const optionalText = (max = 4000) => z.string().trim().max(max, { error: `Maximal ${max} Zeichen.` }).optional().or(z.literal(""));

export const quickApplySchema = z.object({
  firstName: req("Ihren Vornamen"),
  lastName: req("Ihren Nachnamen"),
  phone,
  email,
  city: req("Ihren Wohnort"),
  position: req("eine Position"),
  location: req("einen Standort"),
  licenceB: yesNo,
  experience: yesNo,
  startDate: req("Ihren frühesten Starttermin"),
  consent,
  website: trap,
});
export type QuickApplyValues = z.infer<typeof quickApplySchema>;

export const fullApplySchema = quickApplySchema.extend({
  workExperience: optionalText(),
  employers: optionalText(),
  qualifications: optionalText(),
  languages: optionalText(500),
  licences: z.array(z.string()).optional(),
  message: optionalText(),
});
export type FullApplyValues = z.infer<typeof fullApplySchema>;

export const businessSchema = z.object({
  company: req("das Unternehmen"),
  contactName: req("einen Ansprechpartner"),
  email,
  phone,
  projectLocation: req("den Projektstandort"),
  description: z.string().trim().min(20, { error: "Bitte beschreiben Sie das Projekt in mindestens 20 Zeichen." }).max(4000),
  serviceTypes: z.array(z.string()).min(1, { error: "Bitte mindestens eine Leistungsart wählen." }),
  volume: optionalText(300),
  startDate: optionalText(100),
  vehicleNeed: req("den Fahrzeugbedarf"),
  message: optionalText(),
  consent,
  website: trap,
});
export type BusinessValues = z.infer<typeof businessSchema>;

export const contactSchema = z.object({
  name: req("Ihren Namen"),
  email,
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  subject: req("einen Betreff"),
  message: z.string().trim().min(10, { error: "Bitte schreiben Sie uns mindestens 10 Zeichen." }).max(4000),
  consent,
  website: trap,
});
export type ContactValues = z.infer<typeof contactSchema>;

export const applicationKinds = ["quick", "full", "initiative"] as const;
export type ApplicationKind = (typeof applicationKinds)[number];
