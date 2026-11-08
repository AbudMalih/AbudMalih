/**
 * Freight quote request (China → Germany): shape and validation, shared by
 * the form (UX) and the server route (authoritative). Only whitelisted
 * options pass; free text is single-line except the note.
 */
export const MODES = ["sea_fcl", "sea_lcl", "rail", "air", "advice"] as const;
export const CONTAINERS = ["c20", "c40", "c40hc", "unsure"] as const;
export const INCOTERMS = [
  "exw",
  "fob",
  "cif",
  "dap",
  "ddp",
  "unknown",
] as const;
export const SERVICES = [
  "customs",
  "insurance",
  "warehouse",
  "delivery",
] as const;
export type Mode = (typeof MODES)[number];
export type Container = (typeof CONTAINERS)[number];
export type Incoterm = (typeof INCOTERMS)[number];
export type Service = (typeof SERVICES)[number];

export type Quote = {
  mode: Mode;
  container: Container;
  incoterm: Incoterm;
  origin: string;
  destination: string;
  ready: string;
  goods: string;
  packages: string;
  weight: string;
  volume: string;
  dangerous: boolean;
  services: Service[];
  name: string;
  company: string;
  email: string;
  phone: string;
  note: string;
};
export type QuoteError = "required" | "email" | "long" | "number" | "phone";
export type QuoteErrors = Partial<Record<keyof Quote, QuoteError>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9+()\s./-]{5,40}$/;
const NUM = /^\d{1,7}([.,]\d{1,3})?$/;
const oneLine = (v: string) =>
  v
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
const multiLine = (v: string) =>
  v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, "")
    .trim();
const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T =>
  list.includes(v as T) ? (v as T) : d;

export function normaliseQuote(raw: Record<string, unknown>): Quote {
  const s = (v: unknown) =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  const services = Array.isArray(raw.services)
    ? (raw.services.filter((x) => SERVICES.includes(x as Service)) as Service[])
    : [];
  return {
    mode: pick(MODES, raw.mode, "advice"),
    container: pick(CONTAINERS, raw.container, "unsure"),
    incoterm: pick(INCOTERMS, raw.incoterm, "unknown"),
    origin: oneLine(s(raw.origin)),
    destination: oneLine(s(raw.destination)),
    ready: oneLine(s(raw.ready)).slice(0, 20),
    goods: oneLine(s(raw.goods)),
    packages: oneLine(s(raw.packages)),
    weight: oneLine(s(raw.weight)),
    volume: oneLine(s(raw.volume)),
    dangerous: raw.dangerous === true,
    services: Array.from(new Set(services)),
    name: oneLine(s(raw.name)),
    company: oneLine(s(raw.company)),
    email: s(raw.email).trim(),
    phone: oneLine(s(raw.phone)),
    note: multiLine(s(raw.note)),
  };
}

export function validateQuote(q: Quote): QuoteErrors {
  const e: QuoteErrors = {};
  const req = (k: keyof Quote, max: number) => {
    const v = q[k] as string;
    if (!v) e[k] = "required";
    else if (v.length > max) e[k] = "long";
  };
  req("origin", 120);
  req("destination", 120);
  req("goods", 300);
  req("name", 120);
  if (q.company.length > 160) e.company = "long";
  if (!q.email) e.email = "required";
  else if (q.email.length > 254 || !EMAIL.test(q.email)) e.email = "email";
  if (q.phone && !PHONE.test(q.phone)) e.phone = "phone";
  for (const k of ["packages", "weight", "volume"] as const)
    if (q[k] && !NUM.test(q[k])) e[k] = "number";
  if (q.note.length > 3000) e.note = "long";
  return e;
}
