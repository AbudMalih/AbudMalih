"use client";

import Link from "next/link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  OPEN_CONSENT_EVENT,
  type ConsentState,
  essentialTechnologies,
  optionalTechnologies,
  readConsent,
  writeConsent,
} from "@/lib/consent";

function subscribe(cb: () => void) {
  window.addEventListener("jarbou:consent-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("jarbou:consent-changed", cb);
    window.removeEventListener("storage", cb);
  };
}

/** Cookie banner + settings. No optional technology loads before consent. */
export function CookieConsent() {
  const stored = useSyncExternalStore(subscribe, () => readConsent()?.updatedAt ?? null, () => "server");
  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [statistics, setStatistics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const titleId = useId();
  const visible = reopened || stored === null;

  useEffect(() => {
    const open = () => {
      const c = readConsent();
      setStatistics(c?.statistics ?? false);
      setMarketing(c?.marketing ?? false);
      setDetails(true);
      setReopened(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  const save = (c: Pick<ConsentState, "statistics" | "marketing">) => {
    writeConsent(c);
    setReopened(false);
    setDetails(false);
  };

  if (!visible) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-x-3 bottom-3 z-[60] max-w-md border border-white/15 bg-graphite-900 p-5 text-sm text-steel-200 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] sm:inset-x-auto sm:left-6 sm:bottom-6 sm:p-6"
    >
      <h2 id={titleId} className="text-base font-semibold text-white">
        Datenschutz-Einstellungen
      </h2>
      <p className="mt-2 leading-relaxed">
        Wir verwenden nur technisch notwendige Technologien. Optionale Dienste werden erst nach Ihrer Einwilligung geladen.{" "}
        <Link href="/datenschutz" className="text-white underline underline-offset-4">
          Datenschutzerklärung
        </Link>
      </p>

      {details && (
        <fieldset className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <legend className="sr-only">Kategorien</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-1 size-4 accent-red" />
            <span>
              <span className="font-medium text-white">Notwendig</span>
              <span className="block text-xs text-steel-400">{essentialTechnologies.map((t) => t.purpose).join(" ")}</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={statistics} onChange={(e) => setStatistics(e.target.checked)} className="mt-1 size-4 accent-red" />
            <span>
              <span className="font-medium text-white">Statistik</span>
              <span className="block text-xs text-steel-400">
                {optionalTechnologies.some((t) => t.category === "statistics") ? "Anonyme Reichweitenmessung." : "Derzeit sind keine Statistik-Dienste im Einsatz."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 size-4 accent-red" />
            <span>
              <span className="font-medium text-white">Marketing</span>
              <span className="block text-xs text-steel-400">
                {optionalTechnologies.some((t) => t.category === "marketing") ? "Personalisierte Inhalte." : "Derzeit sind keine Marketing-Dienste im Einsatz."}
              </span>
            </span>
          </label>
        </fieldset>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => save({ statistics: false, marketing: false })} className="min-h-11 flex-1 border border-white/25 px-4 font-semibold text-white hover:border-white">
          Nur notwendige
        </button>
        {details ? (
          <button type="button" onClick={() => save({ statistics, marketing })} className="min-h-11 flex-1 border border-white/25 px-4 font-semibold text-white hover:border-white">
            Auswahl speichern
          </button>
        ) : (
          <button type="button" onClick={() => setDetails(true)} className="min-h-11 flex-1 border border-white/25 px-4 font-semibold text-white hover:border-white">
            Einstellungen
          </button>
        )}
        <button type="button" onClick={() => save({ statistics: true, marketing: true })} className="min-h-11 flex-1 bg-red-cta px-4 font-semibold text-white hover:bg-red-ink">
          Alle akzeptieren
        </button>
      </div>
    </section>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))} className="text-left transition-colors hover:text-white">
      Cookie-Einstellungen
    </button>
  );
}
