"use client";

import { useEffect } from "react";
import PageShell from "@/components/ui/PageShell";
import { useI18n } from "@/content/i18n/I18nProvider";

/** 404: a clear statement and the way home. No canonical; Next marks it noindex. */
export default function NotFound() {
  const { dict, locale } = useI18n();
  const p = dict.pages.notFound;
  useEffect(() => {
    document.title = dict.meta.titleTemplate.replace("%s", p.eyebrow);
  }, [dict, p.eyebrow]);
  return (
    <PageShell
      locale={locale}
      index="404"
      eyebrow={p.eyebrow}
      title={
        <>
          {p.t1} <span className="tone-graphite">{p.t2}</span>
        </>
      }
      lead={p.lead}
      backLabel={p.home}
    />
  );
}
