"use client";

import PageShell from "@/components/ui/PageShell";
import { useI18n } from "@/content/i18n/I18nProvider";

export default function NotFound() {
  const { dict, locale } = useI18n();
  const p = dict.pages.notFound;
  return <PageShell locale={locale} index="404" eyebrow={p.eyebrow} title={<>{p.t1} <span className="tone-graphite">{p.t2}</span></>} />;
}
