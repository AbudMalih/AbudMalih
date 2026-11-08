import type { Locale } from "@/content/i18n/config";
import type { CategoryId } from "./types";

/** Interface copy of the knowledge section (DE/EN/AR). */
export type InsightsCopy = {
  name: string;
  meta: { title: string; description: string };
  hero: { eyebrow: string; h1a: string; h1b: string; lead: string };
  categories: Record<CategoryId, string>;
  all: string;
  topics: string;
  featured: string;
  readingTime: (min: number) => string;
  published: string;
  updated: string;
  reviewed: string;
  sources: string;
  sourcesNote: string;
  keyPoints: string;
  toc: string;
  related: string;
  illustrative: string;
  by: string;
  legalNote: (date: string) => string;
  draft: string;
  backToList: string;
  crumbs: string;
  cta: {
    import: { title: string; text: string; button: string };
    general: { title: string; text: string; button: string };
  };
  closing: { title: string; text: string; button: string };
};

export const INSIGHTS_COPY: Record<Locale, InsightsCopy> = {
  de: {
    name: "Wissen",
    meta: {
      title: "Wissen: Import, Beschaffung, Compliance & Marken",
      description:
        "Fachbeiträge von Luna Trading zu Import aus China, Beschaffung und Qualität, Recht und Compliance sowie Marken und E-Commerce. Klar erklärt, aus der Praxis.",
    },
    hero: {
      eyebrow: "Wissen",
      h1a: "Handel verstehen.",
      h1b: "Besser entscheiden.",
      lead: "Fachbeiträge zu Import, Beschaffung, Compliance und Markenaufbau. Klar erklärt und auf den deutschen und europäischen Markt ausgerichtet.",
    },
    categories: {
      import: "Import & Logistik",
      sourcing: "Beschaffung & Qualität",
      compliance: "Recht & Compliance",
      brands: "Marken & E-Commerce",
    },
    all: "Alle Themen",
    topics: "Themen",
    featured: "Im Fokus",
    readingTime: (m) => `${m} Min. Lesezeit`,
    published: "Veröffentlicht",
    updated: "Aktualisiert",
    reviewed: "Rechtsstand geprüft",
    sources: "Quellen",
    sourcesNote: "Offizielle Quellen, zuletzt abgerufen am Prüfdatum.",
    keyPoints: "Kurz erklärt",
    toc: "Inhalt",
    related: "Weiterlesen",
    illustrative: "Symbolbild",
    by: "Luna Trading",
    legalNote: (d) =>
      `Stand: ${d}. Dieser Beitrag gibt einen allgemeinen Überblick und ersetzt keine Rechts-, Steuer- oder Zollberatung im Einzelfall.`,
    draft: "Entwurf · nur lokal sichtbar",
    backToList: "Alle Beiträge",
    crumbs: "Pfad",
    cta: {
      import: {
        title: "Import planen?",
        text: "Beschreiben Sie Ware, Menge und Route. Wir melden uns mit einem klaren nächsten Schritt.",
        button: "Import anfragen",
      },
      general: {
        title: "Projekt besprechen?",
        text: "Beschaffung, Produkt, Marke oder Vertrieb: Erzählen Sie uns, woran Sie arbeiten.",
        button: "Angebot anfragen",
      },
    },
    closing: {
      title: "Ihre Frage ist nicht dabei?",
      text: "Schreiben Sie uns, wir antworten persönlich.",
      button: "Angebot anfragen",
    },
  },
  en: {
    name: "Insights",
    meta: {
      title: "Insights: Import, Sourcing, Compliance & Brands",
      description:
        "Articles by Luna Trading on importing from China, sourcing and quality, law and compliance, and brands and e-commerce. Clearly explained, from practice.",
    },
    hero: {
      eyebrow: "Insights",
      h1a: "Understand trade.",
      h1b: "Decide better.",
      lead: "Articles on import, sourcing, compliance and brand building. Clearly explained and focused on the German and European market.",
    },
    categories: {
      import: "Import & Logistics",
      sourcing: "Sourcing & Quality",
      compliance: "Law & Compliance",
      brands: "Brands & E-Commerce",
    },
    all: "All topics",
    topics: "Topics",
    featured: "In focus",
    readingTime: (m) => `${m} min read`,
    published: "Published",
    updated: "Updated",
    reviewed: "Legal status reviewed",
    sources: "Sources",
    sourcesNote: "Official sources, last accessed on the review date.",
    keyPoints: "In brief",
    toc: "Contents",
    related: "Read next",
    illustrative: "Illustrative image",
    by: "Luna Trading",
    legalNote: (d) =>
      `As of ${d}. This article is a general overview and does not replace legal, tax or customs advice in an individual case.`,
    draft: "Draft · local preview only",
    backToList: "All articles",
    crumbs: "Breadcrumb",
    cta: {
      import: {
        title: "Planning an import?",
        text: "Describe the goods, quantity and route. We will reply with a clear next step.",
        button: "Request an import",
      },
      general: {
        title: "Discuss a project?",
        text: "Sourcing, product, brand or distribution: tell us what you are working on.",
        button: "Request a quote",
      },
    },
    closing: {
      title: "Your question is not covered?",
      text: "Write to us and we will answer personally.",
      button: "Request a quote",
    },
  },
  ar: {
    name: "المعرفة",
    meta: {
      title: "المعرفة: الاستيراد والتوريد والامتثال والعلامات التجارية",
      description:
        "مقالات من لونا تريدينغ حول الاستيراد من الصين، والتوريد والجودة، والقانون والامتثال، والعلامات التجارية والتجارة الإلكترونية. شرح واضح من واقع العمل.",
    },
    hero: {
      eyebrow: "المعرفة",
      h1a: "افهم التجارة.",
      h1b: "واتخذ قرارات أفضل.",
      lead: "مقالات حول الاستيراد والتوريد والامتثال وبناء العلامات التجارية، بشرح واضح وتركيز على السوق الألمانية والأوروبية.",
    },
    categories: {
      import: "الاستيراد والخدمات اللوجستية",
      sourcing: "التوريد والجودة",
      compliance: "القانون والامتثال",
      brands: "العلامات التجارية والتجارة الإلكترونية",
    },
    all: "كل المواضيع",
    topics: "المواضيع",
    featured: "في الواجهة",
    readingTime: (m) => `${m} دقائق قراءة`,
    published: "تاريخ النشر",
    updated: "آخر تحديث",
    reviewed: "تمت مراجعة الوضع القانوني",
    sources: "المصادر",
    sourcesNote: "مصادر رسمية، تمت مراجعتها بتاريخ المراجعة.",
    keyPoints: "باختصار",
    toc: "المحتويات",
    related: "اقرأ أيضًا",
    illustrative: "صورة توضيحية",
    by: "لونا تريدينغ",
    legalNote: (d) =>
      `الوضع بتاريخ ${d}. يقدّم هذا المقال نظرة عامة ولا يُغني عن الاستشارة القانونية في كل حالة على حدة.`,
    draft: "مسودة · معاينة محلية فقط",
    backToList: "كل المقالات",
    crumbs: "مسار التنقل",
    cta: {
      import: {
        title: "تخطط للاستيراد؟",
        text: "صف البضاعة والكمية والمسار، وسنعود إليك بخطوة تالية واضحة.",
        button: "اطلب استيرادًا",
      },
      general: {
        title: "تريد مناقشة مشروع؟",
        text: "التوريد أو المنتج أو العلامة أو التوزيع: أخبرنا بما تعمل عليه.",
        button: "اطلب عرض سعر",
      },
    },
    closing: {
      title: "لم تجد إجابة سؤالك؟",
      text: "اكتب لنا وسنرد عليك شخصيًا.",
      button: "اطلب عرض سعر",
    },
  },
};
