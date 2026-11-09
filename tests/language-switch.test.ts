// Regression tests for the language selector targets (lib/language-switch.ts).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { languageTarget } from "../lib/language-switch";

const all = ["de", "en", "ar"] as const;
const slugs = {
  "import-china": {
    de: "import-aus-china-nach-deutschland",
    en: "importing-from-china-to-germany",
    ar: "import-china-germany",
  },
  only_de: { de: "nur-deutsch" },
};

test("regular pages switch to the same page and keep the scroll position", () => {
  assert.deepEqual(languageTarget("/what-we-do", "de", "en", all, slugs), {
    href: "/en/services",
    samePage: true,
  });
  assert.deepEqual(languageTarget("/what-we-do", "en", "de", all, slugs), {
    href: "/leistungen",
    samePage: true,
  });
  assert.deepEqual(languageTarget("/impressum", "de", "ar", all, slugs), {
    href: "/ar/impressum",
    samePage: true,
  });
  assert.deepEqual(languageTarget("/", "ar", "de", all, slugs), {
    href: "/",
    samePage: true,
  });
});

test("an article switches directly to its translation", () => {
  const p = "/insights/import-aus-china-nach-deutschland";
  assert.deepEqual(languageTarget(p, "de", "en", all, slugs), {
    href: "/en/insights/importing-from-china-to-germany",
    samePage: true,
  });
  assert.deepEqual(
    languageTarget(
      "/insights/importing-from-china-to-germany",
      "en",
      "ar",
      all,
      slugs,
    ),
    { href: "/ar/insights/import-china-germany", samePage: true },
  );
  assert.deepEqual(
    languageTarget("/insights/import-china-germany", "ar", "de", all, slugs),
    { href: "/wissen/import-aus-china-nach-deutschland", samePage: true },
  );
});

test("the listing switches to the listing", () => {
  assert.deepEqual(languageTarget("/insights", "de", "en", all, slugs), {
    href: "/en/insights",
    samePage: true,
  });
});

test("fallbacks are marked as another page, so they open at the top", () => {
  // article without translation: listing of the target language
  assert.deepEqual(
    languageTarget("/insights/nur-deutsch", "de", "en", all, slugs),
    {
      href: "/en/insights",
      samePage: false,
    },
  );
  // no knowledge section in the target language: its homepage (the bug of
  // November 2026: the homepage opened at the article's scroll position)
  assert.deepEqual(
    languageTarget(
      "/insights/import-aus-china-nach-deutschland",
      "de",
      "en",
      ["de"],
      slugs,
    ),
    { href: "/en", samePage: false },
  );
  assert.deepEqual(languageTarget("/insights", "de", "ar", ["de"], slugs), {
    href: "/ar",
    samePage: false,
  });
});
