import type { Locale } from "./i18n/config";

/**
 * "So arbeiten wir": the human side of the business. Describes the way of
 * working only. No names, numbers, years or customer claims. The photos are
 * illustrative (marked as such on the page) and show no identifiable faces.
 */
export type StoryCopy = {
  tag: string;
  title1: string;
  title2: string;
  lead: string;
  note: string;
  steps: {
    img: "desk" | "check" | "warehouse";
    kicker: string;
    title: string;
    body: string;
    alt: string;
  }[];
  quote: string;
  quoteBy: string;
  visual: { globe: string; carton: string; route: string };
};

export const STORY: Record<Locale, StoryCopy> = {
  de: {
    tag: "So arbeiten wir",
    title1: "Menschen, die Ware",
    title2: "in die Hand nehmen.",
    lead: "Hinter jedem Container stehen Entscheidungen. Wir prüfen Muster, stimmen Details ab und begleiten die Ware, bis sie im Markt ankommt. Persönlich und aus Köln.",
    note: "Symbolbild",
    steps: [
      {
        img: "desk",
        kicker: "Abstimmung",
        title: "Muster prüfen, bevor bestellt wird",
        body: "Material, Verpackung, Route und Preis werden gemeinsam besprochen. Erst wenn alles passt, geht eine Bestellung raus.",
        alt: "Zwei Hände prüfen Produktmuster an einem Schreibtisch, daneben ein Laptop mit Routenkarte.",
      },
      {
        img: "check",
        kicker: "Kontrolle",
        title: "Ware prüfen, bevor sie reist",
        body: "Menge, Kennzeichnung und Zustand werden dokumentiert, damit am Ziel keine Überraschungen warten.",
        alt: "Hände mit Klemmbrett prüfen einen verschlossenen Karton in einem Lager.",
      },
      {
        img: "warehouse",
        kicker: "Distribution",
        title: "Ankommen und weitergeben",
        body: "Nach dem Import wird die Ware eingelagert, vorbereitet und in die passenden Kanäle gebracht.",
        alt: "Eine Person bewegt eine Palette mit Kartons zwischen hohen Lagerregalen.",
      },
    ],
    quote:
      "Wir verkaufen nicht nur Ware. Wir stehen für jeden Schritt, den sie geht.",
    quoteBy: "Luna Trading · Köln",
    visual: {
      globe: "Köln + China",
      carton: "Produkt + Marke",
      route: "Von der Quelle bis zum Markt",
    },
  },
  en: {
    tag: "How we work",
    title1: "People who take",
    title2: "the goods in hand.",
    lead: "Behind every container there are decisions. We check samples, agree on details and stay with the goods until they reach the market. Personally, from Cologne.",
    note: "Illustrative image",
    steps: [
      {
        img: "desk",
        kicker: "Alignment",
        title: "Samples checked before anything is ordered",
        body: "Material, packaging, route and price are discussed together. An order only goes out once everything fits.",
        alt: "Two pairs of hands reviewing product samples at a desk, a laptop with a route map beside them.",
      },
      {
        img: "check",
        kicker: "Inspection",
        title: "Goods checked before they travel",
        body: "Quantity, labelling and condition are documented, so there are no surprises at the destination.",
        alt: "Hands with a clipboard checking a sealed carton in a warehouse.",
      },
      {
        img: "warehouse",
        kicker: "Distribution",
        title: "Arriving and moving on",
        body: "After import, the goods are stored, prepared and brought into the right channels.",
        alt: "A person moving a pallet of cartons between tall warehouse racks.",
      },
    ],
    quote: "We do not just sell goods. We stand behind every step they take.",
    quoteBy: "Luna Trading · Cologne",
    visual: {
      globe: "Cologne + China",
      carton: "Product + Brand",
      route: "From source to market",
    },
  },
  ar: {
    tag: "كيف نعمل",
    title1: "أشخاص يتابعون",
    title2: "البضاعة بأيديهم.",
    lead: "وراء كل حاوية قرارات. نفحص العينات ونتفق على التفاصيل ونرافق البضاعة حتى تصل إلى السوق. بشكل شخصي، من كولونيا.",
    note: "صورة توضيحية",
    steps: [
      {
        img: "desk",
        kicker: "التنسيق",
        title: "فحص العينات قبل أي طلب",
        body: "نناقش المادة والتغليف والمسار والسعر معاً. لا يُرسل الطلب إلا عندما يتوافق كل شيء.",
        alt: "يدان تفحصان عينات منتجات على مكتب وبجانبهما حاسوب محمول يعرض خريطة مسار.",
      },
      {
        img: "check",
        kicker: "الفحص",
        title: "فحص البضاعة قبل أن تسافر",
        body: "نوثق الكمية والملصقات والحالة حتى لا تنتظرنا مفاجآت عند الوصول.",
        alt: "يدان تحملان لوح ملاحظات وتفحصان كرتونة مغلقة في مستودع.",
      },
      {
        img: "warehouse",
        kicker: "التوزيع",
        title: "الوصول ثم الانطلاق",
        body: "بعد الاستيراد تُخزن البضاعة وتُجهز ثم تُنقل إلى القنوات المناسبة.",
        alt: "شخص ينقل منصة كراتين بين رفوف مستودع عالية.",
      },
    ],
    quote: "نحن لا نبيع البضاعة فقط. نحن نقف وراء كل خطوة تخطوها.",
    quoteBy: "Luna Trading · كولونيا",
    visual: {
      globe: "كولونيا + الصين",
      carton: "منتج + علامة",
      route: "من المصدر إلى السوق",
    },
  },
};
