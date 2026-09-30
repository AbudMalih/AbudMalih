import "server-only";

/**
 * Internal notification e-mails (to JARBOU, never to applicants).
 * Deliberately simple, table-based HTML with inline styles so it renders
 * reliably in Outlook, Gmail and mobile clients. Every value is escaped.
 */
export type Row = [label: string, value: string | string[] | null | undefined];
export type Section = { title: string; rows: Row[] };

export type SubmissionEmail = {
  /** e.g. "Kurzbewerbung" */
  kind: string;
  reference: string;
  receivedAt: Date;
  /** Short facts shown prominently at the top. */
  headline: string;
  subline?: string;
  contact: { name: string; email: string; phone?: string | null };
  sections: Section[];
  attachments: { filename: string; size: number }[];
  consentAt: Date | null;
  privacyNote?: string | null;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const nl = (s: string) => esc(s).replace(/\r?\n/g, "<br>");
const val = (v: Row[1]) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : (v ?? "")).trim();

export function formatBerlin(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`);

const INK = "#0b0c0e";
const RED = "#e3070e";
const MUTED = "#5c6168";
const LINE = "#e3e2dd";
const FONT = "Arial, Helvetica, sans-serif";

export function renderSubmissionEmail(e: SubmissionEmail): { html: string; text: string } {
  const received = formatBerlin(e.receivedAt);
  const sections = e.sections
    .map((s) => ({ ...s, rows: s.rows.filter(([, v]) => val(v)) }))
    .filter((s) => s.rows.length);

  const rowsHtml = (rows: Row[]) =>
    rows
      .map(
        ([k, v]) => `<tr>
          <td style="padding:10px 16px 10px 0;border-bottom:1px solid ${LINE};font:13px/1.45 ${FONT};color:${MUTED};vertical-align:top;width:34%">${esc(k)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${LINE};font:14px/1.45 ${FONT};color:${INK};vertical-align:top">${nl(val(v))}</td>
        </tr>`,
      )
      .join("");

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(e.kind)} ${esc(e.reference)}</title></head>
<body style="margin:0;padding:0;background:#f5f4f0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff">
  <tr><td style="background:${INK};padding:22px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:bold 20px/1 ${FONT};color:#ffffff;letter-spacing:.5px"><span style="color:${RED}">//</span>&nbsp;JARBOU <span style="font:normal 12px/1 ${FONT};color:#bfc3c8">Logistik GmbH</span></td>
      <td align="right" style="font:bold 11px/1 ${FONT};color:#bfc3c8;letter-spacing:1.5px;text-transform:uppercase">${esc(e.kind)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:${RED};font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:28px 28px 8px">
    <p style="margin:0 0 6px;font:12px/1.4 ${FONT};color:${MUTED};letter-spacing:1px;text-transform:uppercase">Eingang ${esc(received)} Uhr · Referenz ${esc(e.reference)}</p>
    <h1 style="margin:0;font:bold 24px/1.25 ${FONT};color:${INK}">${esc(e.headline)}</h1>
    ${e.subline ? `<p style="margin:6px 0 0;font:15px/1.45 ${FONT};color:${INK}">${esc(e.subline)}</p>` : ""}
  </td></tr>
  <tr><td style="padding:16px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0"><tr><td style="padding:16px 18px;font:14px/1.6 ${FONT};color:${INK}">
      <strong>${esc(e.contact.name)}</strong><br>
      <a href="mailto:${esc(e.contact.email)}" style="color:${INK}">${esc(e.contact.email)}</a>
      ${e.contact.phone ? `<br><a href="tel:${esc(e.contact.phone.replace(/[^\d+]/g, ""))}" style="color:${INK}">${esc(e.contact.phone)}</a>` : ""}
    </td></tr></table>
  </td></tr>
  ${sections
    .map(
      (s) => `<tr><td style="padding:22px 28px 0">
    <p style="margin:0 0 4px;font:bold 11px/1.4 ${FONT};color:${RED};letter-spacing:1.5px;text-transform:uppercase">${esc(s.title)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml(s.rows)}</table>
  </td></tr>`,
    )
    .join("")}
  <tr><td style="padding:22px 28px 0">
    <p style="margin:0 0 4px;font:bold 11px/1.4 ${FONT};color:${RED};letter-spacing:1.5px;text-transform:uppercase">Anhänge</p>
    <p style="margin:0;font:14px/1.6 ${FONT};color:${INK}">${
      e.attachments.length ? e.attachments.map((a) => `${esc(a.filename)} <span style="color:${MUTED}">(${size(a.size)})</span>`).join("<br>") : "Keine"
    }</p>
  </td></tr>
  <tr><td style="padding:22px 28px 0">
    <p style="margin:0 0 4px;font:bold 11px/1.4 ${FONT};color:${RED};letter-spacing:1.5px;text-transform:uppercase">Datenschutz</p>
    <p style="margin:0;font:13px/1.6 ${FONT};color:${INK}">${
      e.consentAt ? `Einwilligung zur Datenverarbeitung erteilt: ${esc(formatBerlin(e.consentAt))} Uhr (Zeitpunkt der Übermittlung)` : "Keine Einwilligung erforderlich"
    }${e.privacyNote ? `<br><span style="color:${MUTED}">${esc(e.privacyNote)}</span>` : ""}</p>
  </td></tr>
  <tr><td style="padding:28px">
    <p style="margin:0;padding-top:16px;border-top:1px solid ${LINE};font:12px/1.6 ${FONT};color:${MUTED}">
      Mit „Antworten“ schreiben Sie direkt an ${esc(e.contact.email)}.<br>
      Automatisch erstellt über das Formular auf www.jarbou-logistik.com.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `JARBOU Logistik GmbH – ${e.kind}`,
    `Eingang: ${received} Uhr · Referenz: ${e.reference}`,
    "",
    e.headline,
    e.subline ?? "",
    "",
    e.contact.name,
    e.contact.email,
    e.contact.phone ?? "",
    "",
    ...sections.flatMap((s) => [`— ${s.title.toUpperCase()} —`, ...s.rows.map(([k, v]) => `${k}: ${val(v)}`), ""]),
    "— ANHÄNGE —",
    e.attachments.length ? e.attachments.map((a) => `${a.filename} (${size(a.size)})`).join("\n") : "Keine",
    "",
    "— DATENSCHUTZ —",
    e.consentAt ? `Einwilligung erteilt: ${formatBerlin(e.consentAt)} Uhr (Zeitpunkt der Übermittlung)` : "Keine Einwilligung erforderlich",
    e.privacyNote ?? "",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  return { html, text };
}
