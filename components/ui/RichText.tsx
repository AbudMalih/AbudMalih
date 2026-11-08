"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useI18n } from "@/content/i18n/I18nProvider";
import { LINK_TOKEN } from "@/lib/richtext";

/**
 * Body copy with contextual links written inline as [words](/canonical-path#anchor).
 * Paths are canonical routes ("/what-we-do", "/import"); they are localized for
 * the current language. The link keeps the surrounding text's look (inherited
 * colour, a quiet underline) so no new visual element appears.
 */

export default function RichText({ text }: { text: string }) {
  const { href } = useI18n();
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const [path, hash] = m[2].split("#");
    out.push(
      <Link
        key={i}
        href={`${href(path)}${hash ? `#${hash}` : ""}`}
        className="rich-link"
      >
        {m[1]}
      </Link>,
    );
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}
