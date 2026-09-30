"use client";

import { useState } from "react";
import { ApplicationForm, type Option } from "./ApplicationForm";

type Props = {
  positions: Option[];
  locations: Option[];
  careersEmail: string;
  defaultPosition?: string;
  defaultLocation?: string;
};

/** Switch between Kurzbewerbung (default) and vollständiger Bewerbung. */
export function ApplicationExperience(props: Props) {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const tabs = [
    { id: "quick", label: "Kurzbewerbung", meta: "ca. 2 Minuten" },
    { id: "full", label: "Vollständige Bewerbung", meta: "mit Unterlagen" },
  ] as const;
  return (
    <div>
      <div role="radiogroup" aria-label="Art der Bewerbung" className="mb-10 grid grid-cols-2 border border-ink/20 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`min-h-14 px-3 text-left transition-colors sm:px-5 ${mode === t.id ? "bg-ink text-white" : "text-ink hover:bg-ink/5"}`}
          >
            <span className="block text-sm font-semibold sm:text-base">{t.label}</span>
            <span className={`block font-mono text-[0.65rem] uppercase tracking-[0.12em] ${mode === t.id ? "text-steel-300" : "text-steel-600"}`}>{t.meta}</span>
          </button>
        ))}
      </div>
      <ApplicationForm key={mode} mode={mode} {...props} />
    </div>
  );
}
