import type { Cell } from "@turvio/shared";

/**
 * Column headings of report exports (CSV / Excel) in the user's language (`lang` query parameter,
 * English by default). Only the heading row is translated: values stay exactly as stored – dates
 * ISO (YYYY-MM-DD / timestamps), numbers as numbers, statuses as their codes – so files remain
 * comparable and machine-readable whatever language they were downloaded in.
 */
export const EXPORT_LANGS = ["en", "de", "ar"] as const;
export type ExportLang = (typeof EXPORT_LANGS)[number];

const HEADINGS: Record<string, { de: string; ar: string }> = {
  Stops: { de: "Stopps", ar: "المحطات" },
  Delivered: { de: "Zugestellt", ar: "تم التسليم" },
  "Picked up": { de: "Abgeholt", ar: "تم الاستلام" },
  Failed: { de: "Fehlgeschlagen", ar: "فشل" },
  Attempted: { de: "Zustellversuch", ar: "محاولة تسليم" },
  Rescheduled: { de: "Verschoben", ar: "أُعيدت جدولتها" },
  Returned: { de: "Retour", ar: "مُرتجعة" },
  Skipped: { de: "Übersprungen", ar: "تم تخطيها" },
  Cancelled: { de: "Storniert", ar: "ملغاة" },
  Open: { de: "Offen", ar: "مفتوحة" },
  Processed: { de: "Bearbeitet", ar: "تمت معالجتها" },
  "Success rate %": { de: "Erfolgsquote %", ar: "معدل النجاح %" },
  Tours: { de: "Touren", ar: "الجولات" },
  Started: { de: "Gestartet", ar: "بدأت" },
  Completed: { de: "Abgeschlossen", ar: "مكتملة" },
  "Cancelled tours": { de: "Stornierte Touren", ar: "الجولات الملغاة" },
  "Completion rate %": { de: "Abschlussquote %", ar: "معدل الإكمال %" },
  "On-time start rate %": { de: "Pünktliche Starts %", ar: "معدل البدء في الموعد %" },
  "Avg tour minutes": { de: "Ø Tourdauer (Min.)", ar: "متوسط مدة الجولة (دقيقة)" },
  "Active hours": { de: "Aktive Stunden", ar: "الساعات النشطة" },
  "Stops per tour": { de: "Stopps pro Tour", ar: "المحطات لكل جولة" },
  "Stops per active hour": { de: "Stopps pro aktiver Stunde", ar: "المحطات لكل ساعة نشطة" },
  Driver: { de: "Fahrer", ar: "السائق" },
  Location: { de: "Standort", ar: "الموقع" },
  Drivers: { de: "Fahrer", ar: "السائقون" },
  Date: { de: "Datum", ar: "التاريخ" },
  Tour: { de: "Tour", ar: "الجولة" },
  Status: { de: "Status", ar: "الحالة" },
  Archived: { de: "Archiviert", ar: "مؤرشفة" },
  Finished: { de: "Beendet", ar: "انتهت" },
  Minutes: { de: "Minuten", ar: "الدقائق" },
  "Planned km": { de: "Geplante km", ar: "الكيلومترات المخططة" },
  "Planned minutes": { de: "Geplante Minuten", ar: "الدقائق المخططة" },
  "Tours completed": { de: "Abgeschlossene Touren", ar: "الجولات المكتملة" },
  "Period (day)": { de: "Zeitraum (Tag)", ar: "الفترة (يوم)" },
  "Period (week)": { de: "Zeitraum (Woche)", ar: "الفترة (أسبوع)" },
  "Period (month)": { de: "Zeitraum (Monat)", ar: "الفترة (شهر)" },
  Published: { de: "Veröffentlicht", ar: "منشورة" },
  "Archived at": { de: "Archiviert am", ar: "تاريخ الأرشفة" },
  "Closed at": { de: "Beendet am", ar: "تاريخ الإغلاق" },
  "Closed by Dispatch": { de: "Von Dispatch beendet", ar: "أغلقها Dispatch" },
  "Close reason": { de: "Grund für das Beenden", ar: "سبب الإغلاق" },
  Vehicle: { de: "Fahrzeug", ar: "المركبة" },
  "Delivered / picked up": { de: "Zugestellt / abgeholt", ar: "تم التسليم / الاستلام" },
  "Not delivered": { de: "Nicht zugestellt", ar: "لم يتم التسليم" },
  "(no driver)": { de: "(kein Fahrer)", ar: "(بدون سائق)" },
};

/** A heading (or the "(no driver)" placeholder) in the requested language; unknown texts stay English. */
export function heading(text: string, lang: ExportLang): string {
  return lang === "en" ? text : (HEADINGS[text]?.[lang] ?? text);
}

/** Translates the first row of a table (the headings) only. */
export function localizeHeadings(rows: Cell[][], lang: ExportLang): Cell[][] {
  if (lang === "en" || rows.length === 0) return rows;
  return [rows[0]!.map((c) => (typeof c === "string" ? heading(c, lang) : c)), ...rows.slice(1)];
}

/** For tests: every heading the exports use has a translation. */
export const KNOWN_HEADINGS = Object.keys(HEADINGS);
