import type { Locale } from "@/content/i18n/config";

/**
 * IMPORT page copy (DE / EN / AR).
 * Only general, verifiable statements: lanes are typical trade routes, not
 * shipments; transit times are labelled as typical ranges. No carrier,
 * partner or customer names (none are verified).
 */
export type ImportCopy = {
  meta: { title: string; description: string };
  eyebrow: string;
  h1a: string;
  h1b: string;
  lead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  from: string;
  to: string;
  routeLabel: string;
  routeNote: string;
  lanesTitle: string;
  lanes: string[];
  modesTag: string;
  modesTitle: string;
  modesNote: string;
  modes: {
    id: "sea" | "rail" | "air";
    name: string;
    time: string;
    best: string;
  }[];
  stepsTag: string;
  stepsTitle: string;
  steps: { title: string; text: string }[];
  valuesTag: string;
  valuesTitle: string;
  values: { title: string; text: string }[];
  channelsTag: string;
  channelsTitle: string;
  channelsText: string;
  channelsNote: string;
  /** trademark notice below the homepage e-commerce diagram */
  trademarkNote: string;
  carriers: string;
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
};

const de: ImportCopy = {
  meta: {
    title: "Import aus China nach Deutschland",
    description:
      "Luna Trading organisiert Import aus Asien nach Deutschland und Europa: Beschaffung, Qualitätsprüfung, Fracht, Zoll, Lager und Verkauf auf Marktplätzen.",
  },
  eyebrow: "Import · Asien → Europa",
  h1a: "Von China",
  h1b: "nach Deutschland.",
  lead: "Wir finden Hersteller, prüfen Ware vor dem Versand und bringen Ihre Produkte über See, Schiene oder Luft sicher nach Deutschland. Bis ins Lager und auf den Marktplatz.",
  ctaPrimary: "Import anfragen",
  ctaSecondary: "So arbeiten wir",
  from: "Herkunft",
  to: "Ziel",
  routeLabel: "Seefracht",
  routeNote: "Richtwert 30 bis 45 Tage",
  lanesTitle: "Typische Handelsrouten",
  lanes: [
    "Shanghai → Hamburg",
    "Ningbo → Rotterdam",
    "Shenzhen → Antwerpen",
    "Qingdao → Bremerhaven",
    "Xi’an → Duisburg · Schiene",
    "Guangzhou → Frankfurt · Luft",
    "Xiamen → Hamburg",
    "Tianjin → Rotterdam",
  ],
  modesTag: "Transport",
  modesTitle: "Der passende Weg für jede Ware.",
  modesNote:
    "Transitzeiten sind Richtwerte und hängen von Route, Saison und Abfertigung ab.",
  modes: [
    {
      id: "sea",
      name: "Seefracht",
      time: "30 bis 45 Tage",
      best: "Große Mengen, planbare Ware, günstigste Kosten pro Einheit.",
    },
    {
      id: "rail",
      name: "Schienenfracht",
      time: "18 bis 25 Tage",
      best: "Schneller als See, günstiger als Luft. Für Ware mit Termin.",
    },
    {
      id: "air",
      name: "Luftfracht",
      time: "3 bis 7 Tage",
      best: "Muster, Eilaufträge und hochwertige, leichte Produkte.",
    },
  ],
  stepsTag: "Ablauf",
  stepsTitle: "Sechs Schritte. Ein Ansprechpartner.",
  steps: [
    {
      title: "Anfrage",
      text: "Produkt, Menge, Zielpreis und Termin. Wir klären, was wirklich gebraucht wird.",
    },
    {
      title: "Hersteller & Muster",
      text: "[Geeignete Hersteller finden](/what-we-do#sourcing), Angebote vergleichen, Muster prüfen.",
    },
    {
      title: "Qualität vor Versand",
      text: "Kontrolle der Ware und Verpackung, bevor sie das Werk verlässt.",
    },
    {
      title: "Fracht, Zoll & Dokumente",
      text: "Buchung, Verzollung und vollständige Papiere bis zur Ankunft in der EU.",
    },
    {
      title: "Lager & Fulfillment",
      text: "Einlagerung, Kommissionierung und Versand in Deutschland.",
    },
    {
      title: "Verkauf",
      text: "Produkte für Marktplätze und den eigenen Shop vorbereiten und listen.",
    },
  ],
  valuesTag: "Warum Luna Trading",
  valuesTitle: "Import, dem Sie vertrauen können.",
  values: [
    {
      title: "Ein Ansprechpartner in Köln",
      text: "Eine Verantwortung von der Fabrik bis zum Kunden. Auf Deutsch, Englisch und Arabisch.",
    },
    {
      title: "Klare Dokumentation",
      text: "Rechnungen, Packlisten und Zollpapiere vollständig und nachvollziehbar.",
    },
    {
      title: "Konformität im Blick",
      text: "Kennzeichnung, Verpackung und EU-Anforderungen werden vor der Produktion geprüft.",
    },
    {
      title: "Vom Container zum Kunden",
      text: "Import, Lager und Online-Verkauf [aus einer Hand](/company), ohne Übergabelücken.",
    },
  ],
  channelsTag: "Vertrieb",
  channelsTitle: "Vom Container auf den Marktplatz.",
  channelsText:
    "Nach der Ankunft bereiten wir Produkte für den Verkauf vor: [Listing, Bilder, Texte](/what-we-do#ecommerce) und [Logistik](/what-we-do#distribution) für die wichtigsten Kanäle.",
  channelsNote:
    "Vertriebskanäle, für die wir Produkte vorbereiten. Keine Partnerschaften.",
  trademarkNote:
    "Alle Marken und Logos sind Eigentum ihrer jeweiligen Inhaber und werden ausschließlich zur Kennzeichnung und Information genannt. Eine Verbindung oder Empfehlung ist damit nicht verbunden.",
  carriers:
    "Buchung über internationale Reedereien, Bahnoperateure und Luftfrachtführer.",
  ctaTitle: "Ihr nächster Import beginnt mit einem Gespräch.",
  ctaText:
    "Erzählen Sie uns, was Sie importieren möchten. Wir melden uns mit einem klaren nächsten Schritt.",
  ctaButton: "Import anfragen",
};

const en: ImportCopy = {
  meta: {
    title: "Import from China to Germany",
    description:
      "Luna Trading organises imports from Asia to Germany and Europe: sourcing, quality checks, freight, customs, warehousing and marketplace sales.",
  },
  eyebrow: "Import · Asia → Europe",
  h1a: "From China",
  h1b: "to Germany.",
  lead: "We find manufacturers, check goods before shipment and bring your products safely to Germany by sea, rail or air. All the way into the warehouse and onto the marketplace.",
  ctaPrimary: "Request an import",
  ctaSecondary: "How we work",
  from: "Origin",
  to: "Destination",
  routeLabel: "Sea freight",
  routeNote: "Typically 30 to 45 days",
  lanesTitle: "Typical trade lanes",
  lanes: [
    "Shanghai → Hamburg",
    "Ningbo → Rotterdam",
    "Shenzhen → Antwerp",
    "Qingdao → Bremerhaven",
    "Xi’an → Duisburg · Rail",
    "Guangzhou → Frankfurt · Air",
    "Xiamen → Hamburg",
    "Tianjin → Rotterdam",
  ],
  modesTag: "Transport",
  modesTitle: "The right route for every shipment.",
  modesNote:
    "Transit times are typical ranges and depend on route, season and handling.",
  modes: [
    {
      id: "sea",
      name: "Sea freight",
      time: "30 to 45 days",
      best: "Large volumes, planned stock, the lowest cost per unit.",
    },
    {
      id: "rail",
      name: "Rail freight",
      time: "18 to 25 days",
      best: "Faster than sea, cheaper than air. For goods with a deadline.",
    },
    {
      id: "air",
      name: "Air freight",
      time: "3 to 7 days",
      best: "Samples, urgent orders and valuable, light products.",
    },
  ],
  stepsTag: "Process",
  stepsTitle: "Six steps. One contact.",
  steps: [
    {
      title: "Inquiry",
      text: "Product, quantity, target price and date. We clarify what is really needed.",
    },
    {
      title: "Manufacturers & samples",
      text: "[Find suitable manufacturers](/what-we-do#sourcing), compare offers, check samples.",
    },
    {
      title: "Quality before shipment",
      text: "Inspection of goods and packaging before they leave the factory.",
    },
    {
      title: "Freight, customs & documents",
      text: "Booking, customs clearance and complete paperwork until arrival in the EU.",
    },
    {
      title: "Warehousing & fulfilment",
      text: "Storage, picking and shipping in Germany.",
    },
    {
      title: "Sales",
      text: "Prepare and list products for marketplaces and your own shop.",
    },
  ],
  valuesTag: "Why Luna Trading",
  valuesTitle: "Imports you can trust.",
  values: [
    {
      title: "One contact in Cologne",
      text: "One responsibility from the factory to the customer. In German, English and Arabic.",
    },
    {
      title: "Clear documentation",
      text: "Invoices, packing lists and customs papers, complete and traceable.",
    },
    {
      title: "Compliance in view",
      text: "Labelling, packaging and EU requirements are checked before production.",
    },
    {
      title: "From container to customer",
      text: "Import, warehousing and online sales [from one source](/company), without hand-over gaps.",
    },
  ],
  channelsTag: "Sales",
  channelsTitle: "From the container to the marketplace.",
  channelsText:
    "After arrival we prepare products for sale: [listings, images, copy](/what-we-do#ecommerce) and [logistics](/what-we-do#distribution) for the major channels.",
  channelsNote: "Sales channels we prepare products for. Not partnerships.",
  trademarkNote:
    "All trademarks and logos are the property of their respective owners and are displayed for identification and informational purposes only. No affiliation or endorsement is implied.",
  carriers:
    "Booked with international shipping lines, rail operators and air carriers.",
  ctaTitle: "Your next import starts with a conversation.",
  ctaText:
    "Tell us what you would like to import. We will come back with a clear next step.",
  ctaButton: "Request an import",
};

const ar: ImportCopy = {
  meta: {
    title: "الاستيراد من الصين إلى ألمانيا",
    description:
      "تنظّم لونا تريدينغ الاستيراد من آسيا إلى ألمانيا وأوروبا: التوريد، فحص الجودة، الشحن، الجمارك، التخزين والبيع عبر المنصات الإلكترونية.",
  },
  eyebrow: "الاستيراد · آسيا ← أوروبا",
  h1a: "من الصين",
  h1b: "إلى ألمانيا.",
  lead: "نجد المصنّعين، ونفحص البضائع قبل الشحن، ونوصل منتجاتك بأمان إلى ألمانيا بحرًا أو برًّا بالقطار أو جوًّا. حتى المستودع وحتى المنصة الإلكترونية.",
  ctaPrimary: "اطلب استيرادًا",
  ctaSecondary: "كيف نعمل",
  from: "المنشأ",
  to: "الوجهة",
  routeLabel: "شحن بحري",
  routeNote: "عادةً من 30 إلى 45 يومًا",
  lanesTitle: "طرق تجارية نموذجية",
  lanes: [
    "شنغهاي ← هامبورغ",
    "نينغبو ← روتردام",
    "شنجن ← أنتويرب",
    "تشينغداو ← بريمرهافن",
    "شيان ← دويسبورغ · قطار",
    "قوانغتشو ← فرانكفورت · جوًا",
    "شيامن ← هامبورغ",
    "تيانجين ← روتردام",
  ],
  modesTag: "النقل",
  modesTitle: "الطريق المناسب لكل شحنة.",
  modesNote: "مدد العبور تقديرية وتعتمد على المسار والموسم والتخليص.",
  modes: [
    {
      id: "sea",
      name: "الشحن البحري",
      time: "من 30 إلى 45 يومًا",
      best: "كميات كبيرة وبضائع مخطط لها، وأقل تكلفة للوحدة.",
    },
    {
      id: "rail",
      name: "الشحن بالقطار",
      time: "من 18 إلى 25 يومًا",
      best: "أسرع من البحر وأوفر من الجو. للبضائع ذات المواعيد.",
    },
    {
      id: "air",
      name: "الشحن الجوي",
      time: "من 3 إلى 7 أيام",
      best: "العيّنات والطلبات العاجلة والمنتجات الخفيفة عالية القيمة.",
    },
  ],
  stepsTag: "خطوات العمل",
  stepsTitle: "ست خطوات. جهة اتصال واحدة.",
  steps: [
    {
      title: "الطلب",
      text: "المنتج والكمية والسعر المستهدف والموعد. نوضّح ما تحتاجه فعلًا.",
    },
    {
      title: "المصنّعون والعيّنات",
      text: "[إيجاد المصنّعين المناسبين](/what-we-do#sourcing) ومقارنة العروض وفحص العيّنات.",
    },
    {
      title: "الجودة قبل الشحن",
      text: "فحص البضاعة والتغليف قبل خروجها من المصنع.",
    },
    {
      title: "الشحن والجمارك والمستندات",
      text: "الحجز والتخليص الجمركي ومستندات كاملة حتى الوصول إلى الاتحاد الأوروبي.",
    },
    {
      title: "التخزين والتنفيذ",
      text: "التخزين وتجهيز الطلبات والشحن داخل ألمانيا.",
    },
    {
      title: "البيع",
      text: "تجهيز المنتجات وإدراجها على المنصات الإلكترونية ومتجرك الخاص.",
    },
  ],
  valuesTag: "لماذا لونا تريدينغ",
  valuesTitle: "استيراد يمكنك الوثوق به.",
  values: [
    {
      title: "جهة اتصال واحدة في كولونيا",
      text: "مسؤولية واحدة من المصنع حتى العميل. بالألمانية والإنجليزية والعربية.",
    },
    {
      title: "توثيق واضح",
      text: "فواتير وقوائم تعبئة ومستندات جمركية كاملة وواضحة.",
    },
    {
      title: "الامتثال في الحسبان",
      text: "يتم التحقق من الملصقات والتغليف ومتطلبات الاتحاد الأوروبي قبل الإنتاج.",
    },
    {
      title: "من الحاوية إلى العميل",
      text: "الاستيراد والتخزين والبيع الإلكتروني [من مصدر واحد](/company) دون فجوات.",
    },
  ],
  channelsTag: "البيع",
  channelsTitle: "من الحاوية إلى المنصة.",
  channelsText:
    "بعد الوصول نجهّز المنتجات للبيع: [الإدراج والصور والنصوص](/what-we-do#ecommerce) و[الخدمات اللوجستية](/what-we-do#distribution) لأهم القنوات.",
  channelsNote: "قنوات بيع نجهّز المنتجات لها. ليست شراكات.",
  trademarkNote:
    "جميع العلامات التجارية والشعارات ملك لأصحابها المعنيين، وتُعرض لأغراض التعريف والمعلومات فقط، ولا يعني ذلك وجود أي ارتباط أو تأييد.",
  carriers:
    "الحجز لدى شركات الشحن البحري الدولية ومشغّلي السكك الحديدية وشركات الشحن الجوي.",
  ctaTitle: "استيرادك القادم يبدأ بمحادثة.",
  ctaText: "أخبرنا بما تريد استيراده، وسنعود إليك بخطوة تالية واضحة.",
  ctaButton: "اطلب استيرادًا",
};

export const IMPORT_COPY: Record<Locale, ImportCopy> = { de, en, ar };
