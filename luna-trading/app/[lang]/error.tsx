"use client";

import { useEffect } from "react";
import PageShell from "@/components/ui/PageShell";
import { useI18n } from "@/content/i18n/I18nProvider";

/**
 * Unexpected rendering error: a short message, a retry and the way home.
 * Never shows the error itself (no stack, paths or provider details).
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { dict, locale } = useI18n();
  const e = dict.pages.error;
  useEffect(() => {
    document.title = dict.meta.titleTemplate.replace("%s", e.title.replace(/\.$/, ""));
  }, [dict, e.title]);
  return (
    <PageShell locale={locale} index="—" eyebrow={e.title.replace(/\.$/, "")} title={e.title} lead={e.lead} backLabel={dict.pages.notFound.home}>
      <button type="button" onClick={reset} className="link-line t-label" data-cursor="link">
        {e.retry}
      </button>
    </PageShell>
  );
}
