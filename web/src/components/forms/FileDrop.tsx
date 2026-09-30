"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ACCEPT_ATTR, ACCEPT_LABEL, checkFile, FILE_RULES, formatBytes } from "@/lib/forms/files";

type Props = {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  required?: boolean;
  hint?: string;
};

/**
 * Drag & drop + tap-to-upload. On phones the native picker offers files,
 * photos and the camera. PDFs can be previewed in a new tab.
 */
export function FileDrop({ label, files, onChange, multiple = true, required = false, hint }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Object URLs for PDF previews, revoked when the file list changes.
  const urls = useMemo(() => {
    const map = new Map<File, string>();
    files.filter((f) => f.type === "application/pdf").forEach((f) => map.set(f, URL.createObjectURL(f)));
    return map;
  }, [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const next = multiple ? [...files] : [];
    for (const f of incoming) {
      const problem = checkFile(f);
      if (problem) {
        setError(problem);
        return;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (next.length > FILE_RULES.maxFiles) return setError(`Maximal ${FILE_RULES.maxFiles} Dateien.`);
    if (next.reduce((s, f) => s + f.size, 0) > FILE_RULES.maxTotalBytes) return setError("Die Dateien sind zusammen größer als 20 MB.");
    setError(null);
    onChange(next.slice(0, multiple ? FILE_RULES.maxFiles : 1));
  };

  return (
    <div>
      <p id={`${id}-label`} className="mb-2 text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-red-ink"> *</span> : <span className="font-normal text-steel-600"> (optional)</span>}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={`relative flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors ${
          drag ? "border-red bg-red/5" : "border-ink/30 bg-white hover:border-ink/60"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-ink">
          <path d="M12 16V4m0 0l-5 5m5-5l5 5M4 16v4h16v-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <p className="text-base text-ink">
          <button type="button" onClick={() => input.current?.click()} className="font-semibold underline underline-offset-4 hover:text-red-ink">
            Datei auswählen
          </button>
          <span className="hidden sm:inline"> oder hierher ziehen</span>
        </p>
        <p id={`${id}-hint`} className="text-sm text-steel-600">
          {hint ?? ACCEPT_LABEL}
        </p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT_ATTR}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-ink">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/10 border border-ink/15 bg-white" aria-label="Ausgewählte Dateien">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span aria-hidden="true" className="font-mono text-[0.65rem] uppercase text-steel-600">
                {f.name.split(".").pop()}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
              <span className="shrink-0 text-steel-600">{formatBytes(f.size)}</span>
              {urls.get(f) && (
                <a href={urls.get(f)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold underline underline-offset-4">
                  Vorschau
                </a>
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x !== f))}
                className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center hover:text-red-ink"
                aria-label={`${f.name} entfernen`}
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
