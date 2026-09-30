"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Arrow } from "@/components/ui/Button";
import { contactSchema, type ContactValues } from "@/lib/forms/schemas";
import { Consent, Honeypot, TextArea, TextField } from "./fields";
import { FormError, FormSuccess } from "./FormFeedback";
import { useSubmit } from "./submit";

export function ContactForm({ generalEmail }: { generalEmail: string | null }) {
  const { state, submit } = useSubmit("/api/kontakt", "sie");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema) as never,
    mode: "onTouched",
    defaultValues: { consent: false, website: "" },
  });

  if (state.status === "success") {
    return (
      <FormSuccess title="Nachricht erhalten." reference={state.reference}>
        <p>Vielen Dank. Wir haben Ihre Nachricht erhalten.</p>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={handleSubmit((v) => submit(v))} noValidate className="grid gap-5 text-ink sm:grid-cols-2" aria-label="Allgemeiner Kontakt">
      <Honeypot reg={register("website")} />
      <TextField reg={register("name")} label="Name" required error={errors.name} autoComplete="name" />
      <TextField reg={register("email")} label="E-Mail" type="email" inputMode="email" required error={errors.email} autoComplete="email" />
      <TextField reg={register("phone")} label="Telefon" type="tel" inputMode="tel" error={errors.phone} autoComplete="tel" />
      <TextField reg={register("subject")} label="Betreff" required error={errors.subject} />
      <TextArea reg={register("message")} label="Nachricht" required rows={5} className="sm:col-span-2" error={errors.message} />
      <div className="space-y-5 sm:col-span-2">
        <Consent reg={register("consent")} error={errors.consent}>
          Ich willige ein, dass JARBOU Logistik GmbH meine Angaben zur Bearbeitung meiner Nachricht verarbeitet. Details in der{" "}
          <Link href="/datenschutz" className="font-semibold underline underline-offset-4" target="_blank">
            Datenschutzerklärung
          </Link>
          .
        </Consent>
        <FormError
          state={state}
          fallback={
            generalEmail ? (
              <p>
                Bitte schreiben Sie uns an{" "}
                <a className="font-semibold underline underline-offset-4" href={`mailto:${generalEmail}`}>
                  {generalEmail}
                </a>
                .
              </p>
            ) : (
              <p>Bitte versuchen Sie es zu einem späteren Zeitpunkt erneut.</p>
            )
          }
        />
        <button
          type="submit"
          disabled={state.status === "sending"}
          className="group inline-flex min-h-14 w-full items-center justify-center gap-3 bg-red-cta px-8 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-ink disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        >
          {state.status === "sending" ? "Wird gesendet …" : "Nachricht senden"}
          <Arrow className="size-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </form>
  );
}
