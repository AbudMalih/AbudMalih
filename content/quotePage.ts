import type { Locale } from "@/content/i18n/config";
import type {
  Mode,
  Container,
  Incoterm,
  Service,
  QuoteError,
} from "@/lib/quote/schema";

/**
 * FREIGHT QUOTE page copy (DE / EN / AR). Honest by design: no promised
 * response times, prices or references; transit times are typical ranges.
 */
export type QuoteCopy = {
  meta: { title: string; description: string };
  nav: string;
  hero: {
    eyebrow: string;
    h1a: string;
    h1b: string;
    lead: string;
    primary: string;
    secondary: string;
  };
  facts: { k: string; v: string }[];
  form: {
    tag: string;
    title: string;
    intro: string;
    s1: string;
    s2: string;
    s3: string;
    mode: string;
    modes: Record<Mode, { name: string; hint: string }>;
    container: string;
    containers: Record<Container, string>;
    origin: string;
    originPh: string;
    destination: string;
    destinationPh: string;
    incoterm: string;
    incoterms: Record<Incoterm, string>;
    ready: string;
    goods: string;
    goodsPh: string;
    packages: string;
    weight: string;
    volume: string;
    dangerous: string;
    services: string;
    serviceNames: Record<Service, string>;
    name: string;
    company: string;
    email: string;
    phone: string;
    note: string;
    notePh: string;
    optional: string;
    privacy: string;
    privacyLink: string;
    submit: string;
    sending: string;
    errors: Record<QuoteError, string> & { summary: string };
    failTitle: string;
    failText: string;
    mailHint: string;
    mailSend: string;
    rate: string;
    okTitle: string;
    okText: string;
    again: string;
    summary: string;
    summaryEmpty: string;
  };
  next: {
    tag: string;
    title: string;
    steps: { title: string; text: string }[];
  };
  needs: { tag: string; title: string; items: string[] };
};

const de: QuoteCopy = {
  meta: {
    title: "Frachtangebot China – Deutschland anfragen",
    description:
      "Angebot für Seefracht, Schienenfracht oder Luftfracht von China nach Deutschland anfragen: Abholung, Fracht, Zollabwicklung und Zustellung aus einer Hand.",
  },
  nav: "Angebot anfragen",
  hero: {
    eyebrow: "Fracht · China → Deutschland",
    h1a: "Frachtangebot.",
    h1b: "China nach Deutschland.",
    lead: "Seefracht, Schiene oder Luft: Beschreiben Sie Ihre Sendung, und wir erstellen ein Angebot für Abholung, Fracht, Zollabwicklung und Zustellung.",
    primary: "Angebot anfragen",
    secondary: "So läuft es ab",
  },
  facts: [
    { k: "Seefracht", v: "30 bis 45 Tage" },
    { k: "Schiene", v: "18 bis 25 Tage" },
    { k: "Luftfracht", v: "3 bis 7 Tage" },
  ],
  form: {
    tag: "Anfrage",
    title: "Sendung beschreiben.",
    intro:
      "Je genauer die Angaben, desto genauer das Angebot. Felder ohne Kennzeichnung sind Pflicht.",
    s1: "Sendung",
    s2: "Ware",
    s3: "Kontakt",
    mode: "Transportart",
    modes: {
      sea_fcl: { name: "Seefracht FCL", hint: "Vollcontainer" },
      sea_lcl: { name: "Seefracht LCL", hint: "Sammelgut" },
      rail: { name: "Schiene", hint: "China–Europa" },
      air: { name: "Luftfracht", hint: "Eilig, leicht" },
      advice: { name: "Beratung", hint: "Noch offen" },
    },
    container: "Container",
    containers: {
      c20: "20' Standard",
      c40: "40' Standard",
      c40hc: "40' High Cube",
      unsure: "Noch offen",
    },
    origin: "Abholort in China",
    originPh: "z. B. Shenzhen, Ningbo, Yiwu",
    destination: "Ziel in Deutschland",
    destinationPh: "PLZ und Ort",
    incoterm: "Incoterm",
    incoterms: {
      exw: "EXW",
      fob: "FOB",
      cif: "CIF",
      dap: "DAP",
      ddp: "DDP",
      unknown: "Weiß ich nicht",
    },
    ready: "Ware bereit ab",
    goods: "Ware",
    goodsPh: "z. B. Haushaltswaren, Kartons auf Paletten",
    packages: "Packstücke",
    weight: "Gewicht (kg)",
    volume: "Volumen (m³)",
    dangerous: "Gefahrgut (z. B. Akkus, Flüssigkeiten)",
    services: "Zusatzleistungen",
    serviceNames: {
      customs: "Zollabwicklung",
      insurance: "Versicherung",
      warehouse: "Lager / Fulfilment",
      delivery: "Zustellung bis Empfänger",
    },
    name: "Name",
    company: "Unternehmen",
    email: "E-Mail",
    phone: "Telefon",
    note: "Anmerkung",
    notePh: "Zieltermin, Verpackung, Besonderheiten",
    optional: "optional",
    privacy:
      "Ihre Angaben verwenden wir ausschließlich, um Ihre Anfrage zu bearbeiten.",
    privacyLink: "Datenschutz",
    submit: "Angebot anfordern",
    sending: "Wird gesendet",
    errors: {
      required: "Bitte ausfüllen.",
      email: "Bitte eine gültige E-Mail-Adresse angeben.",
      long: "Bitte kürzer fassen.",
      number: "Bitte eine Zahl angeben.",
      phone: "Bitte eine gültige Telefonnummer angeben.",
      summary: "Bitte prüfen Sie die markierten Felder.",
    },
    failTitle: "Ihre Anfrage konnte nicht gesendet werden.",
    failText: "Bitte schreiben Sie uns direkt an",
    mailHint:
      " Senden Sie sie mit einem Klick aus Ihrem E-Mail-Programm, alle Angaben sind bereits eingetragen.",
    mailSend: "Per E-Mail senden",
    rate: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.",
    okTitle: "Danke. Ihre Anfrage ist eingegangen.",
    okText:
      "Wir prüfen Ihre Angaben und melden uns mit einem Angebot oder gezielten Rückfragen.",
    again: "Weitere Anfrage",
    summary: "Ihre Sendung",
    summaryEmpty: "Noch keine Angaben",
  },
  next: {
    tag: "Ablauf",
    title: "Von der Anfrage bis zur Zustellung.",
    steps: [
      {
        title: "Anfrage prüfen",
        text: "Wir prüfen Route, Ware und Termine und klären offene Punkte.",
      },
      {
        title: "Angebot erhalten",
        text: "Sie erhalten ein Angebot mit Transportart, Leistungen und Richtlaufzeit.",
      },
      {
        title: "Buchung & Abholung",
        text: "Nach Ihrer Freigabe buchen wir und organisieren die Abholung beim Lieferanten.",
      },
      {
        title: "Zoll & Zustellung",
        text: "Verzollung in der EU und Zustellung an Ihre Adresse oder Ihr Lager.",
      },
    ],
  },
  needs: {
    tag: "Gut vorbereitet",
    title: "Was ein genaues Angebot braucht.",
    items: [
      "Abholort und Ziel",
      "Art der Ware",
      "Anzahl, Gewicht und Volumen",
      "Gewünschter Termin",
      "Incoterm, falls bekannt",
      "Besonderheiten wie Gefahrgut",
    ],
  },
};

const en: QuoteCopy = {
  meta: {
    title: "Request a freight quote China – Germany",
    description:
      "Request a quote for sea, rail or air freight from China to Germany: pickup, freight, customs clearance and delivery from one source.",
  },
  nav: "Get a quote",
  hero: {
    eyebrow: "Freight · China → Germany",
    h1a: "Freight quote.",
    h1b: "China to Germany.",
    lead: "Sea, rail or air: describe your shipment and we will prepare a quote for pickup, freight, customs clearance and delivery.",
    primary: "Request a quote",
    secondary: "How it works",
  },
  facts: [
    { k: "Sea freight", v: "30 to 45 days" },
    { k: "Rail", v: "18 to 25 days" },
    { k: "Air freight", v: "3 to 7 days" },
  ],
  form: {
    tag: "Request",
    title: "Describe your shipment.",
    intro:
      "The more precise the details, the more precise the quote. Fields without a label are required.",
    s1: "Shipment",
    s2: "Goods",
    s3: "Contact",
    mode: "Mode of transport",
    modes: {
      sea_fcl: { name: "Sea FCL", hint: "Full container" },
      sea_lcl: { name: "Sea LCL", hint: "Groupage" },
      rail: { name: "Rail", hint: "China–Europe" },
      air: { name: "Air freight", hint: "Urgent, light" },
      advice: { name: "Advice", hint: "Not sure yet" },
    },
    container: "Container",
    containers: {
      c20: "20' standard",
      c40: "40' standard",
      c40hc: "40' high cube",
      unsure: "Not sure yet",
    },
    origin: "Pickup location in China",
    originPh: "e.g. Shenzhen, Ningbo, Yiwu",
    destination: "Destination in Germany",
    destinationPh: "Postcode and city",
    incoterm: "Incoterm",
    incoterms: {
      exw: "EXW",
      fob: "FOB",
      cif: "CIF",
      dap: "DAP",
      ddp: "DDP",
      unknown: "I don’t know",
    },
    ready: "Goods ready from",
    goods: "Goods",
    goodsPh: "e.g. household goods, cartons on pallets",
    packages: "Packages",
    weight: "Weight (kg)",
    volume: "Volume (m³)",
    dangerous: "Dangerous goods (e.g. batteries, liquids)",
    services: "Additional services",
    serviceNames: {
      customs: "Customs clearance",
      insurance: "Insurance",
      warehouse: "Warehousing / fulfilment",
      delivery: "Delivery to consignee",
    },
    name: "Name",
    company: "Company",
    email: "E-mail",
    phone: "Phone",
    note: "Note",
    notePh: "Target date, packaging, special requirements",
    optional: "optional",
    privacy: "We use your details only to process your request.",
    privacyLink: "Privacy policy",
    submit: "Request quote",
    sending: "Sending",
    errors: {
      required: "Please fill in.",
      email: "Please enter a valid e-mail address.",
      long: "Please keep it shorter.",
      number: "Please enter a number.",
      phone: "Please enter a valid phone number.",
      summary: "Please check the marked fields.",
    },
    failTitle: "Your request could not be sent.",
    failText: "Please write to us directly at",
    mailHint:
      " Send it with one click from your e-mail app, all details are already filled in.",
    mailSend: "Send by e-mail",
    rate: "Too many requests in a short time. Please try again later.",
    okTitle: "Thank you. Your request has arrived.",
    okText:
      "We will review your details and come back with a quote or specific questions.",
    again: "Another request",
    summary: "Your shipment",
    summaryEmpty: "No details yet",
  },
  next: {
    tag: "Process",
    title: "From request to delivery.",
    steps: [
      {
        title: "Review",
        text: "We check route, goods and dates and clarify open points.",
      },
      {
        title: "Your quote",
        text: "You receive a quote with mode, services and typical transit time.",
      },
      {
        title: "Booking & pickup",
        text: "Once you approve, we book and organise pickup at your supplier.",
      },
      {
        title: "Customs & delivery",
        text: "Customs clearance in the EU and delivery to your address or warehouse.",
      },
    ],
  },
  needs: {
    tag: "Well prepared",
    title: "What a precise quote needs.",
    items: [
      "Pickup and destination",
      "Type of goods",
      "Number, weight and volume",
      "Desired date",
      "Incoterm, if known",
      "Specifics such as dangerous goods",
    ],
  },
};

const ar: QuoteCopy = {
  meta: {
    title: "اطلب عرض سعر للشحن من الصين إلى ألمانيا",
    description:
      "اطلب عرض سعر للشحن البحري أو بالقطار أو الجوي من الصين إلى ألمانيا: الاستلام والشحن والتخليص الجمركي والتسليم من مصدر واحد.",
  },
  nav: "اطلب عرض سعر",
  hero: {
    eyebrow: "الشحن · الصين ← ألمانيا",
    h1a: "عرض سعر الشحن.",
    h1b: "من الصين إلى ألمانيا.",
    lead: "بحرًا أو بالقطار أو جوًا: صِف شحنتك وسنُعدّ لك عرضًا يشمل الاستلام والشحن والتخليص الجمركي والتسليم.",
    primary: "اطلب عرض سعر",
    secondary: "كيف نعمل",
  },
  facts: [
    { k: "الشحن البحري", v: "من 30 إلى 45 يومًا" },
    { k: "القطار", v: "من 18 إلى 25 يومًا" },
    { k: "الشحن الجوي", v: "من 3 إلى 7 أيام" },
  ],
  form: {
    tag: "الطلب",
    title: "صِف شحنتك.",
    intro:
      "كلما كانت البيانات أدق، كان العرض أدق. الحقول غير المعلّمة إلزامية.",
    s1: "الشحنة",
    s2: "البضاعة",
    s3: "التواصل",
    mode: "وسيلة النقل",
    modes: {
      sea_fcl: { name: "بحري FCL", hint: "حاوية كاملة" },
      sea_lcl: { name: "بحري LCL", hint: "شحن مجمّع" },
      rail: { name: "القطار", hint: "الصين–أوروبا" },
      air: { name: "جوي", hint: "عاجل، خفيف" },
      advice: { name: "استشارة", hint: "لم أحدد بعد" },
    },
    container: "الحاوية",
    containers: {
      c20: "‎20' عادية",
      c40: "‎40' عادية",
      c40hc: "‎40' عالية",
      unsure: "لم أحدد بعد",
    },
    origin: "مكان الاستلام في الصين",
    originPh: "مثل شنجن، نينغبو، ييوو",
    destination: "الوجهة في ألمانيا",
    destinationPh: "الرمز البريدي والمدينة",
    incoterm: "شروط التسليم (Incoterm)",
    incoterms: {
      exw: "EXW",
      fob: "FOB",
      cif: "CIF",
      dap: "DAP",
      ddp: "DDP",
      unknown: "لا أعرف",
    },
    ready: "البضاعة جاهزة اعتبارًا من",
    goods: "البضاعة",
    goodsPh: "مثل أدوات منزلية، كراتين على منصات",
    packages: "عدد الطرود",
    weight: "الوزن (كغ)",
    volume: "الحجم (م³)",
    dangerous: "بضائع خطرة (مثل البطاريات والسوائل)",
    services: "خدمات إضافية",
    serviceNames: {
      customs: "التخليص الجمركي",
      insurance: "التأمين",
      warehouse: "التخزين / التنفيذ",
      delivery: "التسليم حتى المستلم",
    },
    name: "الاسم",
    company: "الشركة",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    note: "ملاحظة",
    notePh: "الموعد المطلوب، التغليف، متطلبات خاصة",
    optional: "اختياري",
    privacy: "نستخدم بياناتك فقط لمعالجة طلبك.",
    privacyLink: "سياسة الخصوصية",
    submit: "اطلب العرض",
    sending: "جارٍ الإرسال",
    errors: {
      required: "يرجى التعبئة.",
      email: "يرجى إدخال بريد إلكتروني صحيح.",
      long: "يرجى الاختصار.",
      number: "يرجى إدخال رقم.",
      phone: "يرجى إدخال رقم هاتف صحيح.",
      summary: "يرجى مراجعة الحقول المعلّمة.",
    },
    failTitle: "تعذّر إرسال طلبك.",
    failText: "يرجى مراسلتنا مباشرة على",
    mailHint:
      " أرسله بنقرة واحدة من برنامج البريد لديك، جميع البيانات مُدخلة مسبقًا.",
    mailSend: "إرسال بالبريد الإلكتروني",
    rate: "طلبات كثيرة في وقت قصير. يرجى المحاولة لاحقًا.",
    okTitle: "شكرًا. وصلنا طلبك.",
    okText: "سنراجع بياناتك ونعود إليك بعرض سعر أو بأسئلة محددة.",
    again: "طلب آخر",
    summary: "شحنتك",
    summaryEmpty: "لا توجد بيانات بعد",
  },
  next: {
    tag: "خطوات العمل",
    title: "من الطلب حتى التسليم.",
    steps: [
      {
        title: "مراجعة الطلب",
        text: "نراجع المسار والبضاعة والمواعيد ونوضّح النقاط المفتوحة.",
      },
      {
        title: "استلام العرض",
        text: "تحصل على عرض يتضمن وسيلة النقل والخدمات ومدة العبور التقديرية.",
      },
      {
        title: "الحجز والاستلام",
        text: "بعد موافقتك نحجز وننظّم الاستلام من المورّد.",
      },
      {
        title: "الجمارك والتسليم",
        text: "التخليص الجمركي في الاتحاد الأوروبي والتسليم إلى عنوانك أو مستودعك.",
      },
    ],
  },
  needs: {
    tag: "تحضير جيد",
    title: "ما يحتاجه عرض السعر الدقيق.",
    items: [
      "مكان الاستلام والوجهة",
      "نوع البضاعة",
      "العدد والوزن والحجم",
      "الموعد المطلوب",
      "شروط التسليم إن كانت معروفة",
      "خصائص مثل البضائع الخطرة",
    ],
  },
};

export const QUOTE_COPY: Record<Locale, QuoteCopy> = { de, en, ar };
