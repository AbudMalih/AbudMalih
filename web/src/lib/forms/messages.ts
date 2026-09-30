import type { Tone } from "./schemas";

/**
 * User-facing form messages by result code and tone. The server only returns
 * a code (plus a validation message for `invalid`/`upload`); technical details
 * never reach the browser.
 */
export type ResultCode = "invalid" | "upload" | "too_large" | "not_configured" | "rate_limited" | "failed" | "network" | "forbidden";

export const formMessages: Record<Tone, Record<ResultCode, string>> = {
  du: {
    invalid: "Bitte prüfe deine Angaben.",
    upload: "Mit einer Datei stimmt etwas nicht. Bitte prüfe deine Anhänge.",
    too_large: "Deine Anhänge sind zusammen zu groß (max. 20 MB).",
    not_configured: "Der Online-Versand ist gerade nicht verfügbar.",
    rate_limited: "Du hast gerade mehrere Anfragen gesendet. Bitte versuch es in ein paar Minuten noch einmal.",
    failed: "Deine Bewerbung konnte gerade nicht übermittelt werden. Bitte versuch es gleich noch einmal.",
    network: "Keine Verbindung. Bitte prüfe deine Internetverbindung und versuch es noch einmal – deine Angaben bleiben erhalten.",
    forbidden: "Die Anfrage konnte nicht verarbeitet werden. Bitte lade die Seite neu und versuch es noch einmal.",
  },
  sie: {
    invalid: "Bitte prüfen Sie Ihre Angaben.",
    upload: "Mit einer Datei stimmt etwas nicht. Bitte prüfen Sie die Anhänge.",
    too_large: "Die Anhänge sind zusammen zu groß (max. 20 MB).",
    not_configured: "Der Online-Versand ist derzeit nicht verfügbar.",
    rate_limited: "Sie haben gerade mehrere Anfragen gesendet. Bitte versuchen Sie es in einigen Minuten erneut.",
    failed: "Ihre Nachricht konnte gerade nicht übermittelt werden. Bitte versuchen Sie es gleich noch einmal.",
    network: "Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut – Ihre Angaben bleiben erhalten.",
    forbidden: "Die Anfrage konnte nicht verarbeitet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
  },
};
