"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Arrow } from "@/components/ui/Button";
import type { EmploymentType, PositionCategory } from "@/content/types";

export type JobRow = {
  slug: string;
  title: string;
  location: string;
  category: PositionCategory;
  employmentType: EmploymentType;
  start: string;
  summary: string;
};

type Facets = { locations: string[]; categories: string[]; employmentTypes: string[] };

/** Filterable job list. Facets come from the published jobs only. */
export function JobBoard({ jobs, facets }: { jobs: JobRow[]; facets: Facets }) {
  const [loc, setLoc] = useState("");
  const [cat, setCat] = useState("");
  const [emp, setEmp] = useState("");
  const id = useId();
  const list = useMemo(
    () => jobs.filter((j) => (!loc || j.location === loc) && (!cat || j.category === cat) && (!emp || j.employmentType === emp)),
    [jobs, loc, cat, emp],
  );
  const filters = [
    { key: "loc", label: "Standort", value: loc, set: setLoc, options: facets.locations },
    { key: "cat", label: "Position", value: cat, set: setCat, options: facets.categories },
    { key: "emp", label: "Anstellung", value: emp, set: setEmp, options: facets.employmentTypes },
  ];
  const active = loc || cat || emp;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Stellen filtern">
        {filters.map((f) => (
          <div key={f.key}>
            <label htmlFor={`${id}-${f.key}`} className="mb-2 block font-mono text-[0.68rem] uppercase tracking-[0.14em] text-steel-600">
              {f.label}
            </label>
            <div className="relative">
              <select
                id={`${id}-${f.key}`}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="block min-h-[3.25rem] w-full appearance-none border border-ink/20 bg-white px-4 pr-12 text-base text-ink hover:border-ink/40 focus:border-ink"
              >
                <option value="">Alle</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 12 8" className="pointer-events-none absolute right-4 top-1/2 h-2 w-3 -translate-y-1/2 text-ink">
                <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-b border-ink pb-3">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-steel-600" aria-live="polite">
          {list.length} {list.length === 1 ? "Stelle" : "Stellen"}
        </p>
        {active && (
          <button
            type="button"
            onClick={() => {
              setLoc("");
              setCat("");
              setEmp("");
            }}
            className="min-h-11 text-sm font-semibold underline underline-offset-4"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {list.length ? (
        <ul>
          {list.map((j) => (
            <li key={j.slug} className="border-b border-ink/15">
              <Link href={`/karriere/jobs/${j.slug}`} className="group grid gap-4 py-7 sm:grid-cols-[1fr_auto] sm:items-center lg:py-9">
                <span>
                  <span className="block text-2xl font-extrabold uppercase leading-tight tracking-[-0.02em] transition-colors group-hover:text-red-ink sm:text-3xl">
                    {j.title}
                  </span>
                  <span className="mt-2 block max-w-xl text-graphite-600">{j.summary}</span>
                  <span className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-graphite-600">
                    <span>
                      <span className="sr-only">Standort: </span>
                      {j.location}
                    </span>
                    <span>{j.employmentType}</span>
                    <span>Start: {j.start}</span>
                  </span>
                </span>
                <span className="inline-flex min-h-12 items-center gap-3 self-start bg-ink px-5 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors group-hover:bg-red-cta sm:self-center">
                  Zur Stelle
                  <Arrow className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-12">
          <p className="text-xl font-semibold">Keine Stelle passt zu diesen Filtern.</p>
          <p className="mt-2 text-graphite-600">
            Ändere die Auswahl oder{" "}
            <Link href="/karriere/initiativbewerbung" className="font-semibold underline underline-offset-4">
              bewirb dich initiativ
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
