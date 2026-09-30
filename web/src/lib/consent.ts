/**
 * Consent model (TTDSG / GDPR).
 *
 * - `essential` technologies are always active and need no consent.
 * - `statistics` and `marketing` are opt-in and default to `false`.
 *
 * Optional scripts must be registered in `optionalTechnologies` and are only
 * loaded by <ConsentScripts/> after the matching category is granted.
 * Currently NO analytics or marketing tools are configured.
 */
export type ConsentCategory = "essential" | "statistics" | "marketing";
export type ConsentState = { essential: true; statistics: boolean; marketing: boolean; updatedAt: string; version: number };

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = "jarbou-consent";
export const OPEN_CONSENT_EVENT = "jarbou:open-consent";

export type OptionalTechnology = {
  id: string;
  name: string;
  category: Exclude<ConsentCategory, "essential">;
  purpose: string;
  /** Script URL loaded after consent. */
  src: string;
};

export const optionalTechnologies: OptionalTechnology[] = [];

export const essentialTechnologies = [
  { name: "Einwilligungsspeicher", purpose: "Speichert Ihre Cookie-Auswahl im Browser (localStorage)." },
];

export function readConsent(): ConsentState | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConsent(c: Omit<ConsentState, "essential" | "updatedAt" | "version">): ConsentState {
  const state: ConsentState = { essential: true, ...c, updatedAt: new Date().toISOString(), version: CONSENT_VERSION };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable – consent applies for this page view only */
  }
  window.dispatchEvent(new CustomEvent("jarbou:consent-changed", { detail: state }));
  return state;
}
