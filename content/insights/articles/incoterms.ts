import type { Article } from "../types";

/**
 * DRAFT for template review (Phase 3A). Facts: ICC Incoterms® 2020, in force
 * since 1 January 2020 (11 rules). To be reviewed and approved before
 * publishing (Phase 3B).
 */
export const incoterms: Article = {
  id: "incoterms",
  category: "import",
  status: "draft",
  published: "2026-11-08",
  updated: "2026-11-08",
  cover: { src: "/story/warehouse", illustrative: true },
  related: ["gpsr", "private-label"],
  text: {
    de: {
      slug: "incoterms-import-china",
      title: "Incoterms beim Import aus China: Welche Klausel passt?",
      seoTitle: "Incoterms beim Import aus China erklärt",
      description:
        "EXW, FOB, CIF, DAP oder DDP: Was die Incoterms® 2020 regeln, was nicht, und welche Klausel sich für den Import aus China nach Deutschland eignet.",
      lead: "Mit einer Abkürzung im Kaufvertrag wird festgelegt, wer den Transport bezahlt, wer welche Formalitäten erledigt und wann das Risiko auf den Käufer übergeht. Ein Überblick für Importeure.",
      keyPoints: [
        "Die Incoterms® 2020 der Internationalen Handelskammer (ICC) umfassen elf Klauseln.",
        "Sie regeln Kosten, Risiko und Formalitäten, aber weder Eigentumsübergang noch Zahlung.",
        "FOB und CIF sind für den Seeverkehr gedacht; für Container empfiehlt die ICC eher FCA bzw. CIP.",
        "Bei DDP trägt der Verkäufer auch die Einfuhrabgaben im Zielland, was beim Import nach Deutschland selten passt.",
      ],
      coverAlt:
        "Paletten mit verpackten Kartons in einem Lager zwischen hohen Regalen.",
      body: [
        {
          t: "h2",
          id: "was-regeln-incoterms",
          text: "Was Incoterms regeln und was nicht",
        },
        {
          t: "p",
          text: "Incoterms® sind standardisierte Lieferklauseln der Internationalen Handelskammer (ICC). In der aktuellen Fassung Incoterms® 2020 legen elf Klauseln fest, wer Transport und Versicherung bezahlt, wer Ausfuhr- und Einfuhrformalitäten erledigt und an welchem Punkt das Risiko für Verlust oder Beschädigung vom Verkäufer auf den Käufer übergeht.",
        },
        {
          t: "p",
          text: "Nicht geregelt werden dagegen der Eigentumsübergang, die Zahlungsbedingungen und die Folgen von Vertragsverletzungen. Diese Punkte gehören zusätzlich in den Kaufvertrag.",
        },
        { t: "h2", id: "die-klauseln", text: "Die Klauseln im Überblick" },
        {
          t: "table",
          caption: "Incoterms® 2020, vereinfachte Übersicht",
          head: ["Klausel", "Transportart", "Risikoübergang"],
          rows: [
            ["EXW", "alle", "ab Werk des Verkäufers"],
            ["FCA", "alle", "bei Übergabe an den Frachtführer des Käufers"],
            [
              "FOB",
              "See / Binnenschiff",
              "an Bord des Schiffs im Verschiffungshafen",
            ],
            [
              "CFR / CIF",
              "See / Binnenschiff",
              "an Bord; Verkäufer zahlt Fracht (CIF: auch Versicherung)",
            ],
            [
              "CPT / CIP",
              "alle",
              "bei Übergabe an den ersten Frachtführer; Verkäufer zahlt Fracht (CIP: auch Versicherung)",
            ],
            [
              "DAP / DPU",
              "alle",
              "am benannten Bestimmungsort (DPU: entladen)",
            ],
            ["DDP", "alle", "am Bestimmungsort, einschließlich Einfuhrabgaben"],
          ],
        },
        {
          t: "h2",
          id: "china-deutschland",
          text: "Welche Klausel passt beim Import aus China?",
        },
        {
          t: "p",
          text: "Viele Lieferanten in China bieten FOB an: Sie liefern die Ware bis an Bord im Verschiffungshafen, ab dort organisiert und bezahlt der Käufer die Seefracht. Das gibt Importeuren Kontrolle über Spediteur, Route und Kosten. Mehr zu den Transportwegen finden Sie auf unserer Seite zum [Import aus China](/import#imp-modes).",
        },
        {
          t: "p",
          text: "Für Container empfiehlt die ICC statt FOB eher FCA, weil die Ware in der Praxis meist schon am Containerterminal übergeben wird, also bevor sie an Bord ist. Bei EXW trägt der Käufer dagegen auch die Ausfuhrformalitäten in China, was ohne eigenen Partner vor Ort aufwendig sein kann.",
        },
        {
          t: "note",
          title: "DDP beim Import nach Deutschland",
          text: "Bei DDP übernimmt der Verkäufer auch Einfuhrumsatzsteuer und Zoll im Zielland. Für Importe nach Deutschland passt das selten, weil der ausländische Verkäufer dafür hier steuerlich erfasst sein muss. Klären Sie DDP-Angebote deshalb vorab genau.",
        },
        { t: "h2", id: "praxis", text: "Worauf Importeure achten sollten" },
        {
          t: "ul",
          items: [
            "Klausel immer mit Ort und Version angeben, zum Beispiel „FOB Shanghai, Incoterms® 2020“.",
            "Risikoübergang und Versicherungsschutz aufeinander abstimmen.",
            "Prüfen, wer die Ware vor dem Versand kontrolliert, bevor das Risiko übergeht.",
            "Eigentum und Zahlung zusätzlich im Kaufvertrag regeln.",
          ],
        },
        {
          t: "p",
          text: "Wenn Sie eine konkrete Sendung planen, können Sie uns Ihre Route und Klausel über das [Frachtangebot](/quote) beschreiben.",
        },
      ],
    },
    en: {
      slug: "incoterms-importing-from-china",
      title: "Incoterms when importing from China: which rule fits?",
      seoTitle: "Incoterms for imports from China explained",
      description:
        "EXW, FOB, CIF, DAP or DDP: what the Incoterms® 2020 rules cover, what they do not, and which rule suits imports from China to Germany.",
      lead: "A three-letter code in the sales contract decides who pays for transport, who handles the formalities and when the risk passes to the buyer. An overview for importers.",
      keyPoints: [
        "The Incoterms® 2020 of the International Chamber of Commerce (ICC) contain eleven rules.",
        "They cover costs, risk and formalities, but not transfer of ownership or payment.",
        "FOB and CIF are meant for sea transport; for containers the ICC recommends FCA or CIP instead.",
        "Under DDP the seller also bears import duties in the destination country, which rarely suits imports into Germany.",
      ],
      coverAlt: "Pallets of wrapped cartons in a warehouse between tall racks.",
      body: [
        {
          t: "h2",
          id: "what-incoterms-cover",
          text: "What Incoterms cover and what they do not",
        },
        {
          t: "p",
          text: "Incoterms® are standardised delivery rules published by the International Chamber of Commerce (ICC). In the current Incoterms® 2020, eleven rules define who pays for transport and insurance, who handles export and import formalities and at which point the risk of loss or damage passes from seller to buyer.",
        },
        {
          t: "p",
          text: "They do not cover transfer of ownership, payment terms or the consequences of a breach of contract. These belong in the sales contract as well.",
        },
        { t: "h2", id: "the-rules", text: "The rules at a glance" },
        {
          t: "table",
          caption: "Incoterms® 2020, simplified overview",
          head: ["Rule", "Mode", "Risk passes"],
          rows: [
            ["EXW", "any", "at the seller's premises"],
            ["FCA", "any", "on handover to the buyer's carrier"],
            [
              "FOB",
              "sea / inland waterway",
              "on board the vessel at the port of shipment",
            ],
            [
              "CFR / CIF",
              "sea / inland waterway",
              "on board; seller pays freight (CIF: also insurance)",
            ],
            [
              "CPT / CIP",
              "any",
              "on handover to the first carrier; seller pays freight (CIP: also insurance)",
            ],
            ["DAP / DPU", "any", "at the named destination (DPU: unloaded)"],
            ["DDP", "any", "at the destination, including import duties"],
          ],
        },
        {
          t: "h2",
          id: "china-germany",
          text: "Which rule fits imports from China?",
        },
        {
          t: "p",
          text: "Many suppliers in China offer FOB: they deliver the goods on board at the port of shipment, and from there the buyer arranges and pays for sea freight. This gives importers control over forwarder, route and cost. More on transport modes on our page about [importing from China](/import#imp-modes).",
        },
        {
          t: "p",
          text: "For containers the ICC recommends FCA rather than FOB, because in practice goods are usually handed over at the container terminal, before they are on board. Under EXW the buyer also handles export formalities in China, which can be demanding without a partner on site.",
        },
        {
          t: "note",
          title: "DDP for imports into Germany",
          text: "Under DDP the seller also pays import VAT and customs duty in the destination country. For imports into Germany this rarely fits, because the foreign seller would need to be registered for tax here. Check DDP offers carefully in advance.",
        },
        { t: "h2", id: "in-practice", text: "What importers should watch" },
        {
          t: "ul",
          items: [
            'Always state the rule with place and version, for example "FOB Shanghai, Incoterms® 2020".',
            "Align the transfer of risk with your insurance cover.",
            "Check who inspects the goods before shipment, before the risk passes.",
            "Agree ownership and payment separately in the sales contract.",
          ],
        },
        {
          t: "p",
          text: "If you are planning a shipment, you can describe your route and rule in a [freight quote request](/quote).",
        },
      ],
    },
    ar: {
      slug: "incoterms-import-china",
      title: "شروط الإنكوترمز عند الاستيراد من الصين: أي شرط يناسبك؟",
      seoTitle: "شرح شروط الإنكوترمز للاستيراد من الصين",
      description:
        "EXW وFOB وCIF وDAP وDDP: ما الذي تنظّمه قواعد Incoterms® 2020 وما الذي لا تنظّمه، وأي قاعدة تناسب الاستيراد من الصين إلى ألمانيا.",
      lead: "رمز من ثلاثة أحرف في عقد البيع يحدد من يدفع تكاليف النقل، ومن يتولى الإجراءات، ومتى تنتقل المخاطر إلى المشتري. نظرة عامة للمستوردين.",
      keyPoints: [
        "تضم قواعد Incoterms® 2020 الصادرة عن غرفة التجارة الدولية (ICC) إحدى عشرة قاعدة.",
        "تنظّم التكاليف والمخاطر والإجراءات، لكنها لا تنظّم انتقال الملكية ولا الدفع.",
        "قاعدتا FOB وCIF مخصصتان للنقل البحري، وللحاويات توصي الغرفة بقاعدتي FCA أو CIP.",
        "في DDP يتحمّل البائع أيضًا رسوم الاستيراد في بلد الوجهة، وهذا نادرًا ما يناسب الاستيراد إلى ألمانيا.",
      ],
      coverAlt: "منصات تحمل كراتين مغلّفة في مستودع بين رفوف عالية.",
      body: [
        {
          t: "h2",
          id: "ma-tunazzimuhu",
          text: "ما الذي تنظّمه الإنكوترمز وما الذي لا تنظّمه",
        },
        {
          t: "p",
          text: "الإنكوترمز® قواعد تسليم موحّدة تصدرها غرفة التجارة الدولية (ICC). في النسخة الحالية Incoterms® 2020 تحدد إحدى عشرة قاعدة من يدفع النقل والتأمين، ومن يتولى إجراءات التصدير والاستيراد، وعند أي نقطة تنتقل مخاطر الفقد أو التلف من البائع إلى المشتري.",
        },
        {
          t: "p",
          text: "ولا تنظّم انتقال الملكية ولا شروط الدفع ولا عواقب الإخلال بالعقد، فهذه يجب أن ترد في عقد البيع أيضًا.",
        },
        { t: "h2", id: "al-qawaid", text: "القواعد باختصار" },
        {
          t: "table",
          caption: "Incoterms® 2020، عرض مبسّط",
          head: ["القاعدة", "وسيلة النقل", "انتقال المخاطر"],
          rows: [
            ["EXW", "كل الوسائل", "في منشأة البائع"],
            ["FCA", "كل الوسائل", "عند التسليم لناقل المشتري"],
            ["FOB", "بحري / نهري", "على متن السفينة في ميناء الشحن"],
            [
              "CFR / CIF",
              "بحري / نهري",
              "على متن السفينة؛ البائع يدفع الشحن (CIF: والتأمين)",
            ],
            [
              "CPT / CIP",
              "كل الوسائل",
              "عند التسليم لأول ناقل؛ البائع يدفع الشحن (CIP: والتأمين)",
            ],
            [
              "DAP / DPU",
              "كل الوسائل",
              "في مكان الوجهة المسمّى (DPU: بعد التفريغ)",
            ],
            ["DDP", "كل الوسائل", "في الوجهة شاملة رسوم الاستيراد"],
          ],
        },
        {
          t: "h2",
          id: "al-sin-almania",
          text: "أي قاعدة تناسب الاستيراد من الصين؟",
        },
        {
          t: "p",
          text: "يعرض كثير من الموردين في الصين قاعدة FOB: يسلّمون البضاعة على متن السفينة في ميناء الشحن، ومن هناك يتولى المشتري الشحن البحري ويدفع تكاليفه. وهذا يمنح المستورد تحكمًا في شركة الشحن والمسار والتكلفة. المزيد عن وسائل النقل في صفحتنا حول [الاستيراد من الصين](/import#imp-modes).",
        },
        {
          t: "p",
          text: "وللحاويات توصي الغرفة بقاعدة FCA بدل FOB، لأن البضاعة تُسلَّم عمليًا في محطة الحاويات قبل وصولها إلى متن السفينة. أما في EXW فيتولى المشتري أيضًا إجراءات التصدير في الصين، وهذا قد يكون صعبًا دون شريك محلي.",
        },
        {
          t: "note",
          title: "قاعدة DDP عند الاستيراد إلى ألمانيا",
          text: "في DDP يدفع البائع أيضًا ضريبة الاستيراد والرسوم الجمركية في بلد الوجهة. وهذا نادرًا ما يناسب الاستيراد إلى ألمانيا، لأن البائع الأجنبي يحتاج إلى تسجيل ضريبي هنا. لذلك راجع عروض DDP بدقة مسبقًا.",
        },
        {
          t: "h2",
          id: "fi-al-amal",
          text: "ما الذي يجب أن ينتبه إليه المستورد",
        },
        {
          t: "ul",
          items: [
            "اذكر القاعدة دائمًا مع المكان والنسخة، مثل «FOB Shanghai, Incoterms® 2020».",
            "نسّق انتقال المخاطر مع تغطية التأمين.",
            "تحقّق ممن يفحص البضاعة قبل الشحن وقبل انتقال المخاطر.",
            "نظّم الملكية والدفع في عقد البيع بشكل منفصل.",
          ],
        },
        {
          t: "p",
          text: "إذا كنت تخطط لشحنة، يمكنك وصف المسار والقاعدة في [طلب عرض سعر للشحن](/quote).",
        },
      ],
    },
  },
};
