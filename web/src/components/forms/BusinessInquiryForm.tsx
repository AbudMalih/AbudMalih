"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Arrow } from "@/components/ui/Button";
import { businessSchema, type BusinessValues } from "@/lib/forms/schemas";
import { CheckboxGroup, Consent, Honeypot, SelectField, TextArea, TextField } from "./fields";
import { FileDrop } from "./FileDrop";
import { FormError, FormSuccess } from "./FormFeedback";
import { useSubmit } from "./submit";

type Props = { serviceTypes: string[]; vehicleNeeds: readonly string[]; businessEmail: string | null };

export function BusinessInquiryForm({ serviceTypes, vehicleNeeds, businessEmail }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const { state, submit } = useSubmit("/api/geschaeftsanfrage", "sie");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessValues>({
    resolver: zodResolver(businessSchema) as never,
    mode: "onTouched",
    defaultValues: { serviceTypes: [], consent: false, website: "" },
  });

  if (state.status === "success") {
    return (
      <FormSuccess title="Anfrage erhalten." reference={state.reference}>
        <p>Vielen Dank für Ihr Interesse an JARBOU. Wir haben Ihre Projektanfrage erhalten und melden uns bei Ihnen, um die nächsten Schritte abzustimmen.</p>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={handleSubmit((v) => submit(v, files))} noValidate className="text-ink" aria-label="Projektanfrage">
      <Honeypot reg={register("website")} />
      <fieldset>
        <legend className="mb-5 text-lg font-bold uppercase tracking-[-0.01em]">Ansprechpartner</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField reg={register("company")} label="Unternehmen" required error={errors.company} autoComplete="organization" />
          <TextField reg={register("contactName")} label="Ansprechpartner" required error={errors.contactName} autoComplete="name" />
          <TextField reg={register("email")} label="E-Mail" type="email" inputMode="email" required error={errors.email} autoComplete="email" />
          <TextField reg={register("phone")} label="Telefon" type="tel" inputMode="tel" required error={errors.phone} autoComplete="tel" />
        </div>
      </fieldset>

      <fieldset className="mt-12">
        <legend className="mb-5 text-lg font-bold uppercase tracking-[-0.01em]">Projekt</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField reg={register("projectLocation")} label="Projektstandort" placeholder="Stadt oder Region" required error={errors.projectLocation} />
          <SelectField
            reg={register("vehicleNeed")}
            label="Fahrzeugbedarf"
            required
            error={errors.vehicleNeed}
            options={vehicleNeeds.map((v) => ({ value: v, label: v }))}
          />
          <TextField reg={register("volume")} label="Erwartetes Volumen" placeholder="z. B. Stopps oder Sendungen pro Tag" error={errors.volume} />
          <TextField reg={register("startDate")} label="Gewünschter Start" placeholder="z. B. Q1 2027" error={errors.startDate} />
          <div className="sm:col-span-2">
            <CheckboxGroup reg={register("serviceTypes")} label="Leistungsart" required options={serviceTypes} error={errors.serviceTypes as never} />
          </div>
          <TextArea
            reg={register("description")}
            label="Projektbeschreibung"
            required
            rows={5}
            className="sm:col-span-2"
            hint="Ausgangslage, Gebiete, Zeitfenster, Besonderheiten"
            error={errors.description}
          />
        </div>
      </fieldset>

      <div className="mt-12 grid gap-5">
        <FileDrop label="Datei hochladen" files={files} onChange={setFiles} hint="z. B. Ausschreibung oder Gebietsübersicht · PDF, Word, JPG, PNG" />
        <TextArea reg={register("message")} label="Nachricht" rows={4} error={errors.message} />
        <Consent reg={register("consent")} error={errors.consent}>
          Ich willige ein, dass JARBOU Logistik GmbH meine Angaben zur Bearbeitung der Anfrage verarbeitet. Details in der{" "}
          <Link href="/datenschutz" className="font-semibold underline underline-offset-4" target="_blank">
            Datenschutzerklärung
          </Link>
          .
        </Consent>
        <FormError
          state={state}
          fallback={
            businessEmail ? (
              <p>
                Bitte schreiben Sie uns an{" "}
                <a className="font-semibold underline underline-offset-4" href={`mailto:${businessEmail}`}>
                  {businessEmail}
                </a>
                .
              </p>
            ) : (
              <p>Bitte versuchen Sie es zu einem späteren Zeitpunkt erneut.</p>
            )
          }
        />
        <div>
          <button
            type="submit"
            disabled={state.status === "sending"}
            className="group inline-flex min-h-14 w-full items-center justify-center gap-3 bg-red-cta px-8 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-ink disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          >
            {state.status === "sending" ? "Wird gesendet …" : "Anfrage senden"}
            <Arrow className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </form>
  );
}
