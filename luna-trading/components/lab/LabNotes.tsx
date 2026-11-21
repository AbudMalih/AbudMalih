"use client";

import { useState } from "react";

export type Note = {
  tech: string[];
  distinct: string;
  business: string;
  mobile: string;
  perf: string;
};

/** "About this experiment": the facts the review needs, one click away. */
export default function LabNotes({ title, note }: { title: string; note: Note }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="labNotesBtn"
        aria-expanded={open}
        aria-controls="lab-notes"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Schließen" : <><span className="hideSm">Über dieses Experiment</span><span className="showSm">Info</span></>}
      </button>
      <aside id="lab-notes" className="labNotes" data-open={open || undefined} aria-label={title} hidden={!open}>
        <p className="mono" style={{ color: "var(--red-on-dark)" }}>{title}</p>
        <dl>
          <dt>Technologien</dt>
          <dd>{note.tech.join(" · ")}</dd>
          <dt>Was es besonders macht</dt>
          <dd>{note.distinct}</dd>
          <dt>Nutzen für Luna Trading</dt>
          <dd>{note.business}</dd>
          <dt>Mobil & Barrierefreiheit</dt>
          <dd>{note.mobile}</dd>
          <dt>Performance</dt>
          <dd>{note.perf}</dd>
        </dl>
      </aside>
    </>
  );
}
