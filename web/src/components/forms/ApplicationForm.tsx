"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { Arrow } from "@/components/ui/Button";
import { applicationSteps, licenceClasses } from "@/content/careers";
import { fullApplySchema, quickApplySchema, type FullApplyValues } from "@/lib/forms/schemas";
import { CheckboxGroup, Consent, Honeypot, SelectField, TextArea, TextField, YesNo } from "./fields";
import { FileDrop } from "./FileDrop";
import { FormError, FormSuccess } from "./FormFeedback";
import { useSubmit } from "./submit";

export type Option = { value: string; label: string };
export type ApplicationMode = "quick" | "full" | "initiative";

type Props = {
  mode: ApplicationMode;
  positions: Option[];
  locations: Option[];
  careersEmail: string;
  defaultPosition?: string;
  defaultLocation?: string;
};

const QUICK_REQUIRED: FieldPath<FullApplyValues>[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "city",
  "position",
  "location",
  "licenceB",
  "experience",
  "startDate",
  "consent",
];

const STEPS: { title: string; fields: FieldPath<FullApplyValues>[] }[] = [
  { title: "Kontakt", fields: ["firstName", "lastName", "phone", "email", "city"] },
  { title: "Stelle", fields: ["position", "location", "licenceB", "experience", "startDate"] },
  { title: "Erfahrung", fields: ["workExperience", "employers", "qualifications", "languages", "licences"] },
  { title: "Unterlagen", fields: ["message"] },
  { title: "Absenden", fields: ["consent"] },
];

const btnPrimary =
  "group inline-flex min-h-14 w-full items-center justify-center gap-3 bg-red-cta px-8 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-ink disabled:cursor-wait disabled:opacity-70 sm:w-auto";
const btnGhost =
  "inline-flex min-h-14 w-full items-center justify-center gap-3 border border-ink/25 px-8 text-sm font-semibold uppercase tracking-[0.12em] text-ink hover:border-ink sm:w-auto";

export function ApplicationForm({ mode, positions, locations, careersEmail, defaultPosition, defaultLocation }: Props) {
  const isQuick = mode === "quick";
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const top = useRef<HTMLDivElement>(null);
  const { state, submit } = useSubmit("/api/bewerbung");

  const form = useForm<FullApplyValues>({
    resolver: zodResolver(isQuick ? quickApplySchema : fullApplySchema) as never,
    mode: "onTouched",
    defaultValues: {
      position: defaultPosition ?? (mode === "initiative" ? "" : ""),
      location: defaultLocation ?? "",
      licences: [],
      consent: false,
      website: "",
    },
  });
  const {
    register,
    handleSubmit,
    trigger,
    control,
    formState: { errors },
  } = form;
  const watched = useWatch({ control });

  const done = QUICK_REQUIRED.filter((k) => {
    const v = watched[k as keyof typeof watched];
    return typeof v === "boolean" ? v : Boolean(v && String(v).trim());
  }).length;

  const onSubmit = handleSubmit((values) => submit(values, files, { kind: mode }));

  const next = async () => {
    const ok = await trigger(STEPS[step]!.fields);
    if (ok) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const back = () => {
    setStep((s) => Math.max(0, s - 1));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (state.status === "success") {
    return (
      <FormSuccess title="Vielen Dank für Ihre Bewerbung." reference={state.reference}>
        <p>Ihre Bewerbung ist bei uns eingegangen. So geht es weiter:</p>
        <ol className="mt-4 space-y-1 text-sm">
          {applicationSteps.slice(1, 4).map((s) => (
            <li key={s.id}>
              <span className="font-mono text-red-glow">{s.index}</span> {s.title}
            </li>
          ))}
        </ol>
      </FormSuccess>
    );
  }

  const fallback = (
    <p>
      Senden Sie Ihre Bewerbung bitte an{" "}
      <a className="font-semibold underline underline-offset-4" href={`mailto:${careersEmail}?subject=${encodeURIComponent("Bewerbung")}`}>
        {careersEmail}
      </a>
      .
    </p>
  );

  const positionField =
    mode === "initiative" ? (
      <TextField
        reg={register("position")}
        label="Gewünschte Tätigkeit"
        placeholder="z. B. Fahrer, Disposition"
        required
        error={errors.position}
        autoComplete="off"
        list="initiative-roles"
      />
    ) : (
      <SelectField reg={register("position")} label="Position" required error={errors.position} options={positions} />
    );

  const contactFields = (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField reg={register("firstName")} label="Vorname" required error={errors.firstName} autoComplete="given-name" />
      <TextField reg={register("lastName")} label="Nachname" required error={errors.lastName} autoComplete="family-name" />
      <TextField reg={register("phone")} label="Telefonnummer" required error={errors.phone} type="tel" inputMode="tel" autoComplete="tel" />
      <TextField reg={register("email")} label="E-Mail" required error={errors.email} type="email" inputMode="email" autoComplete="email" />
      <TextField reg={register("city")} label="Wohnort" required error={errors.city} autoComplete="address-level2" className="sm:col-span-2" />
    </div>
  );

  const jobFields = (
    <div className="grid gap-5 sm:grid-cols-2">
      {positionField}
      <SelectField reg={register("location")} label="Standort" required error={errors.location} options={locations} />
      <YesNo reg={register("licenceB")} label="Führerschein Klasse B" error={errors.licenceB} />
      <YesNo reg={register("experience")} label="KEP- / Logistikerfahrung" error={errors.experience} />
      <TextField reg={register("startDate")} label="Frühester Starttermin" required error={errors.startDate} type="date" className="sm:col-span-2" />
      <datalist id="initiative-roles">
        <option value="Fahrer" />
        <option value="Disposition" />
        <option value="Teamleitung" />
        <option value="Verwaltung" />
      </datalist>
    </div>
  );

  const consent = (
    <Consent reg={register("consent")} error={errors.consent}>
      Ich willige ein, dass JARBOU Logistik GmbH meine Angaben und Unterlagen zur Bearbeitung meiner Bewerbung verarbeitet. Die Einwilligung kann ich jederzeit
      widerrufen. Details in der{" "}
      <Link href="/datenschutz" className="font-semibold underline underline-offset-4" target="_blank">
        Datenschutzerklärung
      </Link>
      .
    </Consent>
  );

  /* ---------------- Quick apply ---------------- */
  if (isQuick) {
    return (
      <form onSubmit={onSubmit} noValidate className="relative text-ink" aria-label="Kurzbewerbung">
        <Honeypot reg={register("website")} />
        <div className="sticky top-0 z-10 -mx-5 mb-8 border-b border-ink/10 bg-paper/95 px-5 py-3 backdrop-blur-sm sm:mx-0 sm:px-0">
          <div className="flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-[0.14em] text-steel-600">
            <span>Kurzbewerbung · ca. 2 Minuten</span>
            <span aria-live="polite">
              {done} / {QUICK_REQUIRED.length}
            </span>
          </div>
          <div className="mt-2 h-1 bg-ink/10" role="progressbar" aria-label="Fortschritt" aria-valuemin={0} aria-valuemax={QUICK_REQUIRED.length} aria-valuenow={done}>
            <div className="h-full bg-red transition-[width] duration-500" style={{ width: `${(done / QUICK_REQUIRED.length) * 100}%` }} />
          </div>
        </div>

        <fieldset className="space-y-5">
          <legend className="mb-5 text-lg font-bold uppercase tracking-[-0.01em]">Über Sie</legend>
          {contactFields}
        </fieldset>
        <fieldset className="mt-10 space-y-5">
          <legend className="mb-5 text-lg font-bold uppercase tracking-[-0.01em]">Ihre Stelle</legend>
          {jobFields}
        </fieldset>
        <div className="mt-10">
          <FileDrop label="Lebenslauf" files={files} onChange={setFiles} multiple={false} hint="PDF, Word oder Foto · max. 10 MB" />
        </div>
        <div className="mt-10 space-y-5">
          {consent}
          <FormError state={state} fallback={fallback} />
          <button type="submit" className={btnPrimary} disabled={state.status === "sending"}>
            {state.status === "sending" ? "Wird gesendet …" : "Bewerbung absenden"}
            <Arrow className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </form>
    );
  }

  /* ---------------- Full / initiative (steps) ---------------- */
  const v = watched;
  const positionLabel = positions.find((p) => p.value === v.position)?.label ?? v.position;
  const summary: [string, string | undefined][] = [
    ["Name", [v.firstName, v.lastName].filter(Boolean).join(" ")],
    ["Kontakt", [v.phone, v.email].filter(Boolean).join(" · ")],
    ["Wohnort", v.city],
    [mode === "initiative" ? "Tätigkeit" : "Position", positionLabel],
    ["Standort", v.location],
    ["Führerschein B", v.licenceB === "ja" ? "Ja" : v.licenceB === "nein" ? "Nein" : undefined],
    ["Erfahrung", v.experience === "ja" ? "Ja" : v.experience === "nein" ? "Nein" : undefined],
    ["Starttermin", v.startDate ? v.startDate.split("-").reverse().join(".") : undefined],
    ["Weitere Klassen", v.licences?.length ? v.licences.join(", ") : undefined],
    ["Dokumente", files.length ? files.map((f) => f.name).join(", ") : "Keine"],
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="text-ink" aria-label={mode === "initiative" ? "Initiativbewerbung" : "Vollständige Bewerbung"}>
      <Honeypot reg={register("website")} />
      <div ref={top} className="scroll-mt-28">
        <ol className="grid grid-cols-5 gap-1.5" aria-label="Fortschritt">
          {STEPS.map((s, i) => (
            <li key={s.title} aria-current={i === step ? "step" : undefined}>
              <span className={`block h-1 ${i <= step ? "bg-red" : "bg-ink/15"} transition-colors`} />
              <span className={`mt-2 hidden font-mono text-[0.65rem] uppercase tracking-[0.12em] sm:block ${i === step ? "text-ink" : "text-steel-600"}`}>
                {String(i + 1).padStart(2, "0")} {s.title}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-steel-600 sm:hidden" aria-live="polite">
          Schritt {step + 1} von {STEPS.length} · {STEPS[step]!.title}
        </p>
      </div>

      <div className="mt-8">
        <p className="sr-only" aria-live="polite">
          Schritt {step + 1}: {STEPS[step]!.title}
        </p>
        <div hidden={step !== 0}>{contactFields}</div>
        <div hidden={step !== 1}>{jobFields}</div>
        <div hidden={step !== 2} className="space-y-5">
          <TextArea reg={register("workExperience")} label="Berufserfahrung" hint="Tätigkeiten und Zeiträume in Stichpunkten" error={errors.workExperience} />
          <TextArea reg={register("employers")} label="Bisherige Arbeitgeber" rows={3} error={errors.employers} />
          <TextArea reg={register("qualifications")} label="Qualifikationen" hint="z. B. Staplerschein, Schulungen, Weiterbildungen" rows={3} error={errors.qualifications} />
          <TextField reg={register("languages")} label="Sprachen" placeholder="z. B. Deutsch, Englisch" error={errors.languages} />
          <CheckboxGroup reg={register("licences")} label="Zusätzliche Führerscheinklassen" options={licenceClasses} columns={4} />
        </div>
        <div hidden={step !== 3} className="space-y-5">
          <FileDrop label="Dokumente" files={files} onChange={setFiles} hint="Lebenslauf, Zeugnisse, Nachweise · PDF, Word, JPG oder PNG · bis zu 5 Dateien" />
          <TextArea reg={register("message")} label="Nachricht" rows={5} error={errors.message} />
        </div>
        <div hidden={step !== 4} className="space-y-6">
          <dl className="divide-y divide-ink/10 border-y border-ink/15">
            {summary.map(([k, val]) => (
              <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-4 py-3 text-sm sm:grid-cols-[11rem_1fr]">
                <dt className="text-steel-600">{k}</dt>
                <dd className="break-words font-medium">{val || "–"}</dd>
              </div>
            ))}
          </dl>
          {consent}
          <FormError state={state} fallback={fallback} />
        </div>
      </div>

      <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <button type="button" onClick={back} className={btnGhost}>
            Zurück
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className={btnPrimary}>
            Weiter
            <Arrow className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
        ) : (
          <button type="submit" className={btnPrimary} disabled={state.status === "sending"}>
            {state.status === "sending" ? "Wird gesendet …" : "Bewerbung absenden"}
            <Arrow className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </form>
  );
}
