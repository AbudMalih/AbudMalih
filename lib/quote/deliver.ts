// Server-only module: imported solely by app/api/quote/route.ts.
import { sendToInbox, type DeliveryResult } from "@/lib/contact/deliver";
import type { Quote } from "./schema";

/** German labels: the inbox works in the company language. */
const MODE: Record<Quote["mode"], string> = {
  sea_fcl: "Seefracht FCL (Vollcontainer)",
  sea_lcl: "Seefracht LCL (Sammelgut)",
  rail: "Schienenfracht",
  air: "Luftfracht",
  advice: "Beratung gewünscht",
};
const CONTAINER: Record<Quote["container"], string> = { c20: "20' Standard", c40: "40' Standard", c40hc: "40' High Cube", unsure: "–" };
const INCOTERM: Record<Quote["incoterm"], string> = { exw: "EXW", fob: "FOB", cif: "CIF", dap: "DAP", ddp: "DDP", unknown: "Noch offen" };
const SERVICE: Record<Quote["services"][number], string> = {
  customs: "Zollabwicklung",
  insurance: "Transportversicherung",
  warehouse: "Lagerung / Fulfilment",
  delivery: "Zustellung bis Empfänger",
};

export async function deliverQuote(q: Quote, meta: { locale: string }): Promise<DeliveryResult> {
  const row = (k: string, v: string) => `${(k + ":").padEnd(20)}${v || "–"}`;
  const text = [
    "Neue Frachtanfrage China → Deutschland über luna-trading.de",
    "",
    "SENDUNG",
    row("Transportart", MODE[q.mode]),
    row("Container", q.mode === "sea_fcl" ? CONTAINER[q.container] : "–"),
    row("Abholort (China)", q.origin),
    row("Ziel (Deutschland)", q.destination),
    row("Incoterm", INCOTERM[q.incoterm]),
    row("Ware bereit ab", q.ready),
    "",
    "WARE",
    row("Beschreibung", q.goods),
    row("Packstücke", q.packages),
    row("Gewicht (kg)", q.weight),
    row("Volumen (m³)", q.volume),
    row("Gefahrgut", q.dangerous ? "JA" : "nein"),
    row("Zusatzleistungen", q.services.map((s) => SERVICE[s]).join(", ")),
    "",
    "KONTAKT",
    row("Name", q.name),
    row("Unternehmen", q.company),
    row("E-Mail", q.email),
    row("Telefon", q.phone),
    row("Sprache", meta.locale.toUpperCase()),
    "",
    "Anmerkung:",
    q.note || "–",
    "",
    "–",
    "Antworten Sie direkt auf diese E-Mail, um der anfragenden Person zu schreiben.",
  ].join("\n");
  const subject = `[Frachtanfrage] ${MODE[q.mode]} · ${q.origin} → ${q.destination} · ${q.company || q.name}`.slice(0, 200);
  return sendToInbox({ subject, text, replyTo: { name: q.name, address: q.email } });
}
