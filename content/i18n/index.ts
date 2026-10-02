import type { Dictionary } from "./types";
import type { Locale } from "./config";
import de from "./de";
import en from "./en";
import ar from "./ar";

export * from "./config";
export type { Dictionary } from "./types";

const DICTS: Record<Locale, Dictionary> = { de, en, ar };
export const getDictionary = (locale: Locale) => DICTS[locale];
