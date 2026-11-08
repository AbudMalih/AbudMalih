import type { Locale } from "@/content/i18n/config";

/** The four topic areas of the knowledge section. */
export type CategoryId = "import" | "sourcing" | "compliance" | "brands";

/**
 * Article body: a small set of typed blocks. Text may contain inline links
 * written as [words](/canonical-path#anchor) (see components/ui/RichText.tsx).
 * Every `h2` becomes an entry of the table of contents (needs a stable `id`).
 */
export type Block =
  | { t: "h2"; id: string; text: string }
  | { t: "h3"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "note"; title?: string; text: string }
  | { t: "table"; caption?: string; head: string[]; rows: string[][] };

/** One language version of an article. */
export type ArticleText = {
  /** URL slug in this language (lowercase, hyphens) */
  slug: string;
  title: string;
  /** optional shorter <title>; falls back to `title` */
  seoTitle?: string;
  /** meta description, ~150 characters */
  description: string;
  lead: string;
  /** "Kurz erklärt": 3–5 key points */
  keyPoints: string[];
  coverAlt: string;
  body: Block[];
  /** official references, shown as "Quellen" and cited in structured data */
  sources?: Source[];
};

/** An authoritative reference (authority, law or official publication). */
export type Source = {
  title: string;
  /** issuing body, e.g. "Generalzolldirektion" or "EUR-Lex" */
  publisher: string;
  url: string;
};

export type Article = {
  /** stable id, also used for related articles */
  id: string;
  category: CategoryId;
  /**
   * Only "published" articles exist in production builds. "draft" articles
   * are rendered by the local development server only (never built, listed,
   * linked or added to the sitemap in production).
   */
  status: "draft" | "published";
  /** ISO dates (YYYY-MM-DD): real dates only */
  published: string;
  updated: string;
  /** date the legal or regulatory information was last reviewed (shown on the article) */
  reviewed?: string;
  cover: {
    /** /public path without size suffix; files <src>-960.webp and <src>-1600.webp */
    src: string;
    /** AI-generated or otherwise illustrative image: labelled "Symbolbild" */
    illustrative: boolean;
  };
  /** ids of related articles (optional; same category is used otherwise) */
  related?: string[];
  /** language versions; a language exists only when written and approved */
  text: Partial<Record<Locale, ArticleText>>;
};
