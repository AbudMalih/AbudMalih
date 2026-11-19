import type { Locale } from "../define";
import admins from "./admins";
import audit from "./audit";
import auth from "./auth";
import common from "./common";
import companies from "./companies";
import company from "./company";
import overview from "./overview";
import plans from "./plans";
import shell from "./shell";
import system from "./system";

/** One file per area (namespace); keys are used as `namespace.key`. */
export const NAMESPACES = { common, shell, auth, overview, companies, company, audit, admins, plans, system };

type All = typeof NAMESPACES;
type Base<K> = K extends `${infer B}#${string}` ? B : K;
export type MessageKey = { [N in keyof All & string]: `${N}.${Base<keyof All[N]["en"] & string>}` }[keyof All & string];

function flatten(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [ns, m] of Object.entries(NAMESPACES)) {
    for (const [k, v] of Object.entries((m as unknown as Record<Locale, Record<string, string>>)[locale])) out[`${ns}.${k}`] = v;
  }
  return out;
}
export const DICTIONARIES: Record<Locale, Record<string, string>> = { en: flatten("en"), de: flatten("de"), ar: flatten("ar") };
