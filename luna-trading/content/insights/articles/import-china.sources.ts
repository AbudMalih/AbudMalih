import type { Locale } from "@/content/i18n/config";
import type { Source } from "../types";

/**
 * The 31 official sources of the article "Import aus China nach
 * Deutschland", in every language: same documents, localized titles and
 * publishers. EUR-Lex and Access2Markets are linked in the reader's language
 * where the EU publishes one (no Arabic exists: English is used); German-only
 * official pages are linked as they are and marked as German.
 * Checked on 8 November 2026.
 */
type Entry = {
  title: Record<Locale, string>;
  publisher: Record<Locale, string>;
  /** German URL; `en` used for English and Arabic when given */
  url: { de: string; en?: string };
  /** the linked page exists only in German */
  germanOnly?: boolean;
};

const ZOLL = {
  de: "Zoll online, Generalzolldirektion",
  en: "German Customs (Zoll online), Federal Customs Directorate General",
  ar: "الجمارك الألمانية (Zoll online)، المديرية العامة للجمارك",
};
const BMJ = {
  de: "Bundesministerium der Justiz, gesetze-im-internet.de",
  en: "German Federal Ministry of Justice, gesetze-im-internet.de",
  ar: "وزارة العدل الاتحادية الألمانية، gesetze-im-internet.de",
};
const EURLEX = {
  de: "EUR-Lex, Amt für Veröffentlichungen der EU",
  en: "EUR-Lex, Publications Office of the EU",
  ar: "EUR-Lex، مكتب منشورات الاتحاد الأوروبي",
};
const EC = {
  de: "Europäische Kommission",
  en: "European Commission",
  ar: "المفوضية الأوروبية",
};
const EC_TRADE = {
  de: "Europäische Kommission, GD Handel",
  en: "European Commission, DG Trade",
  ar: "المفوضية الأوروبية، المديرية العامة للتجارة",
};
const EC_TAXUD = {
  de: "Europäische Kommission, GD Steuern und Zollunion",
  en: "European Commission, DG Taxation and Customs Union",
  ar: "المفوضية الأوروبية، المديرية العامة للضرائب والاتحاد الجمركي",
};
const eurlex = (celex: string) => ({
  de: `https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:${celex}`,
  en: `https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${celex}`,
});

const ENTRIES: Entry[] = [
  {
    title: {
      de: "Beantragung einer EORI-Nummer und Änderung der Beteiligtendaten",
      en: "Applying for an EORI number and amending operator details",
      ar: "طلب رقم EORI وتعديل بيانات الجهة الاقتصادية",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Zoelle/EORI-Nummer/Beantragung-einer-EORI-Nummer/beantragung-einer-eori-nummer_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Onlineverpflichtung ab 1. Oktober 2026 für EORI-Formulare",
      en: "Online obligation for EORI applications from 1 October 2026",
      ar: "إلزامية التقديم الإلكتروني لطلبات EORI اعتبارًا من 1 أكتوبر 2026",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/SharedDocs/Fachmeldungen/Aktuelle-Einzelmeldungen/2026/azr_onlineverpflichtung_eori_formulare_ab_20261001.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Vertretung im Zollrecht",
      en: "Representation in customs law",
      ar: "التمثيل في قانون الجمارك",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zollanmeldung/Vertretung/vertretung_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Zollanmeldung: notwendige Unterlagen",
      en: "Customs declaration: required documents",
      ar: "البيان الجمركي: المستندات المطلوبة",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zollanmeldung/Notwendige-Unterlagen/notwendige-unterlagen_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Verbindliche Zolltarifauskunft: Antrag, Erteilung, Gültigkeit",
      en: "Binding Tariff Information: application, issue, validity",
      ar: "المعلومات التعريفية الملزمة: الطلب والإصدار والصلاحية",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zolltarif/verbindliche-Zolltarifauskunft/Antrag-Erteilung-Gueltigkeit/antrag-erteilung-gueltigkeit_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Zollwert: Beförderungs- und Versicherungskosten",
      en: "Customs value: transport and insurance costs",
      ar: "القيمة الجمركية: تكاليف النقل والتأمين",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zollwert/Methoden-der-Zollwertermittlung/Transaktionswert-fuer-die-eingefuehrte-Ware/Berichtigungen-Artikel-71-72-UZK/Befoerderungs-und-Versicherungskosten/befoerderungs-und-versicherungskosten_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Wegfall der 150-Euro-Zollfreigrenze",
      en: "End of the EUR 150 customs duty exemption",
      ar: "إلغاء الإعفاء الجمركي للشحنات حتى 150 يورو",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Zoelle/Wegfall-der-150-Euro-Zollfreigrenze/wegfall-der-150-euro-zollfreigrenze_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Verordnung (EU) 2026/382 zur Abschaffung der schwellenbasierten Zollbefreiung",
      en: "Regulation (EU) 2026/382 abolishing the threshold-based customs duty relief",
      ar: "اللائحة (EU) 2026/382 بشأن إلغاء الإعفاء الجمركي القائم على الحد الأدنى للقيمة",
    },
    publisher: EURLEX,
    url: eurlex("32026R0382"),
  },
  {
    title: {
      de: "Einfuhrumsatzsteuer: Bemessungsgrundlage",
      en: "Import VAT: taxable amount",
      ar: "ضريبة القيمة المضافة على الاستيراد: الوعاء الضريبي",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Steuern/Einfuhrumsatzsteuer/Bemessungsgrundlage/bemessungsgrundlage_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Berechnung von Einfuhrabgaben (Rechenbeispiel)",
      en: "Calculating import charges (worked example)",
      ar: "حساب رسوم الاستيراد (مثال حسابي)",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Steuern/Einfuhrumsatzsteuer/Bemessungsgrundlage/marginalspalte_beispiel_faq.html?faqCalledDoc=132938",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "Einfuhrumsatzsteuer: Vorsteuerabzug",
      en: "Import VAT: input tax deduction",
      ar: "ضريبة القيمة المضافة على الاستيراد: خصم ضريبة المدخلات",
    },
    publisher: ZOLL,
    url: {
      de: "https://www.zoll.de/DE/Fachthemen/Steuern/Einfuhrumsatzsteuer/Vorsteuerabzug/vorsteuerabzug_node.html",
    },
    germanOnly: true,
  },
  {
    title: {
      de: "§ 21 Umsatzsteuergesetz: Besondere Vorschriften für die Einfuhrumsatzsteuer",
      en: "Section 21 German VAT Act: special rules for import VAT",
      ar: "المادة 21 من قانون ضريبة القيمة المضافة الألماني: أحكام خاصة بضريبة الاستيراد",
    },
    publisher: BMJ,
    url: { de: "https://www.gesetze-im-internet.de/ustg_1980/__21.html" },
    germanOnly: true,
  },
  {
    title: {
      de: "Delegierte Verordnung (EU) Nr. 1421/2013 (Streichung Chinas aus dem Allgemeinen Präferenzsystem)",
      en: "Delegated Regulation (EU) No 1421/2013 (removal of China from the Generalised Scheme of Preferences)",
      ar: "اللائحة المفوضة (EU) رقم 1421/2013 (شطب الصين من نظام الأفضليات المعمم)",
    },
    publisher: EURLEX,
    url: eurlex("32013R1421"),
  },
  {
    title: {
      de: "EU extends duties on electric bicycles from China",
      en: "EU extends duties on electric bicycles from China",
      ar: "الاتحاد الأوروبي يمدد الرسوم على الدراجات الكهربائية من الصين",
    },
    publisher: EC_TRADE,
    url: {
      de: "https://policy.trade.ec.europa.eu/news/eu-extends-duties-electric-bicycles-china-2025-01-24_en",
    },
  },
  {
    title: {
      de: "Access2Markets: Zölle und Maßnahmen nach Warennummer",
      en: "Access2Markets: duties and measures by product code",
      ar: "Access2Markets: الرسوم والتدابير حسب رمز السلعة",
    },
    publisher: EC,
    url: {
      de: "https://trade.ec.europa.eu/access-to-markets/de/home",
      en: "https://trade.ec.europa.eu/access-to-markets/en/home",
    },
  },
  {
    title: {
      de: "ICS2 extends to rail and road transportation from April 2025",
      en: "ICS2 extends to rail and road transportation from April 2025",
      ar: "توسيع نظام ICS2 ليشمل النقل بالسكك الحديدية والطرق اعتبارًا من أبريل 2025",
    },
    publisher: EC_TAXUD,
    url: {
      de: "https://taxation-customs.ec.europa.eu/news/eu-import-control-system-2-ics2-extends-rail-and-road-transportation-april-2025-2025-02-03_en",
    },
  },
  {
    title: {
      de: "Incoterms® rules",
      en: "Incoterms® rules",
      ar: "قواعد Incoterms®",
    },
    publisher: {
      de: "Internationale Handelskammer (ICC)",
      en: "International Chamber of Commerce (ICC)",
      ar: "غرفة التجارة الدولية (ICC)",
    },
    url: { de: "https://iccwbo.org/business-solutions/incoterms-rules/" },
  },
  {
    title: {
      de: "Incoterms® 2020: FCA or FOB?",
      en: "Incoterms® 2020: FCA or FOB?",
      ar: "Incoterms® 2020: هل FCA أم FOB؟",
    },
    publisher: { de: "ICC Academy", en: "ICC Academy", ar: "ICC Academy" },
    url: {
      de: "https://academy.iccwbo.org/incoterms/article/incoterms-2020-fca-or-fob/",
    },
  },
  {
    title: {
      de: "Verordnung (EU) 2023/988 über die allgemeine Produktsicherheit",
      en: "Regulation (EU) 2023/988 on general product safety",
      ar: "اللائحة (EU) 2023/988 بشأن السلامة العامة للمنتجات",
    },
    publisher: EURLEX,
    url: eurlex("32023R0988"),
  },
  {
    title: {
      de: "Beschluss Nr. 768/2008/EG über einen gemeinsamen Rechtsrahmen für die Vermarktung von Produkten",
      en: "Decision No 768/2008/EC on a common framework for the marketing of products",
      ar: "القرار رقم 768/2008/EC بشأن إطار مشترك لتسويق المنتجات",
    },
    publisher: EURLEX,
    url: eurlex("32008D0768"),
  },
  {
    title: {
      de: "Verordnung (EU) 2019/1020 über Marktüberwachung und die Konformität von Produkten",
      en: "Regulation (EU) 2019/1020 on market surveillance and compliance of products",
      ar: "اللائحة (EU) 2019/1020 بشأن مراقبة السوق ومطابقة المنتجات",
    },
    publisher: EURLEX,
    url: eurlex("32019R1020"),
  },
  {
    title: {
      de: "PPWR und VerpackDG: Das gilt seit dem 12. August 2026",
      en: "PPWR and VerpackDG: what has applied since 12 August 2026",
      ar: "لائحة PPWR وقانون VerpackDG: ما يسري منذ 12 أغسطس 2026",
    },
    publisher: {
      de: "Zentrale Stelle Verpackungsregister",
      en: "Central Agency Packaging Register (ZSVR)",
      ar: "السجل المركزي للتغليف في ألمانيا (ZSVR)",
    },
    url: {
      de: "https://www.verpackungsregister.org/ich-moechte-wissen-was-seit-dem-12-august-2026-gilt",
      en: "https://www.verpackungsregister.org/en/i-want-to-know-what-changed-on-12-august-2026",
    },
  },
  {
    title: {
      de: "§ 3 Elektro- und Elektronikgerätegesetz: Begriffsbestimmungen",
      en: "Section 3 German Electrical and Electronic Equipment Act (ElektroG): definitions",
      ar: "المادة 3 من قانون الأجهزة الكهربائية والإلكترونية الألماني (ElektroG): التعريفات",
    },
    publisher: BMJ,
    url: { de: "https://www.gesetze-im-internet.de/elektrog_2015/__3.html" },
    germanOnly: true,
  },
  {
    title: {
      de: "§ 6 Elektro- und Elektronikgerätegesetz: Registrierung",
      en: "Section 6 German Electrical and Electronic Equipment Act (ElektroG): registration",
      ar: "المادة 6 من قانون الأجهزة الكهربائية والإلكترونية الألماني (ElektroG): التسجيل",
    },
    publisher: BMJ,
    url: { de: "https://www.gesetze-im-internet.de/elektrog_2015/__6.html" },
    germanOnly: true,
  },
  {
    title: {
      de: "stiftung elektro-altgeräte register",
      en: "stiftung elektro-altgeräte register (German WEEE register)",
      ar: "stiftung elektro-altgeräte register (السجل الألماني للأجهزة الكهربائية)",
    },
    publisher: { de: "stiftung ear", en: "stiftung ear", ar: "stiftung ear" },
    url: { de: "https://www.stiftung-ear.de" },
    germanOnly: true,
  },
  {
    title: {
      de: "Carbon Border Adjustment Mechanism",
      en: "Carbon Border Adjustment Mechanism",
      ar: "آلية تعديل الكربون على الحدود (CBAM)",
    },
    publisher: EC_TAXUD,
    url: {
      de: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
    },
  },
  {
    title: {
      de: "Verordnung (EU) 2023/956 (CBAM), konsolidierte Fassung, Artikel 2a und Anhang VII",
      en: "Regulation (EU) 2023/956 (CBAM), consolidated version, Article 2a and Annex VII",
      ar: "اللائحة (EU) 2023/956 (CBAM)، النسخة الموحدة، المادة 2a والملحق السابع",
    },
    publisher: EURLEX,
    url: eurlex("02023R0956-20251020"),
  },
  {
    title: {
      de: "CBAM: communication and FAQs",
      en: "CBAM: communication and FAQs",
      ar: "CBAM: المعلومات والأسئلة الشائعة",
    },
    publisher: EC_TAXUD,
    url: {
      de: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-communication-and-faqs_en",
    },
  },
  {
    title: {
      de: "Regulation on Deforestation-free Products",
      en: "Regulation on Deforestation-free Products",
      ar: "لائحة المنتجات الخالية من إزالة الغابات",
    },
    publisher: {
      de: "Europäische Kommission, GD Umwelt",
      en: "European Commission, DG Environment",
      ar: "المفوضية الأوروبية، المديرية العامة للبيئة",
    },
    url: {
      de: "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en",
    },
  },
  {
    title: {
      de: "Verordnung (EU) 2025/2650 zur Änderung der EUDR",
      en: "Regulation (EU) 2025/2650 amending the EUDR",
      ar: "اللائحة (EU) 2025/2650 المعدِّلة للائحة EUDR",
    },
    publisher: EURLEX,
    url: eurlex("32025R2650"),
  },
  {
    title: {
      de: "Delay until December 2026 and other developments in the implementation of the EUDR",
      en: "Delay until December 2026 and other developments in the implementation of the EUDR",
      ar: "التأجيل حتى ديسمبر 2026 وتطورات أخرى في تطبيق لائحة EUDR",
    },
    publisher: {
      de: "Europäische Kommission, Access2Markets",
      en: "European Commission, Access2Markets",
      ar: "المفوضية الأوروبية، Access2Markets",
    },
    url: {
      de: "https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation",
    },
  },
];

const GERMAN = { de: "", en: " (in German)", ar: " (باللغة الألمانية)" };

/** The sources in one language. */
export function importChinaSources(locale: Locale): Source[] {
  return ENTRIES.map((e) => ({
    title: e.title[locale],
    publisher: e.publisher[locale] + (e.germanOnly ? GERMAN[locale] : ""),
    url: locale === "de" ? e.url.de : (e.url.en ?? e.url.de),
  }));
}
