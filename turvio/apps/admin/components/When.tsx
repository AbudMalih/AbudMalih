"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n/client";

/**
 * A date or time in the viewer's language and time zone. Rendered in the browser (after hydration),
 * so server-rendered pages never show the server's time zone.
 */
export function When({ iso, as = "date", now, className }: { iso: string; as?: "date" | "time" | "dateTime" | "relative"; now?: number; className?: string }) {
  const { fmt } = useI18n();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(
      as === "time"
        ? fmt.time(iso)
        : as === "dateTime"
          ? fmt.date(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
          : as === "relative"
            ? fmt.relative(iso, now ?? Date.now())
            : fmt.date(iso, { day: "2-digit", month: "short", year: "numeric" }),
    );
  }, [iso, as, now, fmt]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text ?? " "}
    </time>
  );
}
