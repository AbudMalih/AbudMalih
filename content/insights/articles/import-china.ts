import type { Article } from "../types";
import { importChinaSources } from "./import-china.sources";
import { importChinaEn } from "./import-china.en";
import { importChinaAr } from "./import-china.ar";

/**
 * PUBLISHED (Phase 3B, article 1); goes live only with a deployment.
 * German original; English and Arabic translations in import-china.en.ts and
 * import-china.ar.ts. Every legal or regulatory statement was checked against the official sources listed in `sources`
 * on the review date (8 November 2026). Costs are named as components only:
 * no prices are stated. Transport times are the same indicative ranges as on
 * the Import page.
 */
export const importChina: Article = {
  id: "import-china",
  category: "import",
  status: "published",
  published: "2026-11-09",
  updated: "2026-11-09",
  reviewed: "2026-11-08",
  cover: {
    src: "/insights/container-terminal",
    illustrative: true,
    height: 893,
  },
  related: ["incoterms", "gpsr", "private-label"],
  text: {
    de: {
      slug: "import-aus-china-nach-deutschland",
      title: "Import aus China nach Deutschland: Ablauf, Kosten und Dokumente",
      seoTitle: "Import aus China: Ablauf, Kosten & Dokumente",
      description:
        "Import aus China nach Deutschland Schritt für Schritt: Lieferanten, Incoterms, Transport, Zoll, EORI, Einfuhrumsatzsteuer, Produktpflichten und Kosten.",
      lead: "Wer Waren aus China einführt, verbindet Einkauf, Logistik, Zoll, Steuern und Produktrecht. Dieser Leitfaden zeigt den Ablauf bis zur verkaufsfähigen Ware in Deutschland, erklärt die wichtigsten Pflichten und nennt die Kostenbestandteile, die in jede Kalkulation gehören.",
      keyPoints: [
        "Vor der ersten Einfuhr braucht Ihr Unternehmen eine EORI-Nummer. Sie ist kostenlos und wird seit 1. Oktober 2026 grundsätzlich über das Zoll-Portal beantragt.",
        "Zoll und Einfuhrumsatzsteuer richten sich nach der Einreihung der Ware und ihrem Zollwert. Für Waren aus China gilt in der Regel der normale Drittlandszollsatz, für einzelne Waren zusätzlich Antidumping- oder Ausgleichszölle.",
        "Die Einfuhrumsatzsteuer beträgt 19 oder 7 Prozent. Unternehmen mit Vorsteuerabzug können sie in der Regel als Vorsteuer geltend machen, müssen sie aber zunächst bezahlen.",
        "Produktsicherheit, CE-Kennzeichnung, Verpackungsrecht und produktspezifische Vorschriften sind getrennte Pflichten. Sie müssen erfüllt sein, bevor die Ware verkauft wird.",
        "Feste Pauschalpreise für einen Import gibt es nicht. Die Kosten hängen von Ware, Menge, Transportart, Lieferklausel und Zeitpunkt ab.",
      ],
      coverAlt:
        "Ein Portalkran setzt in einem Containerterminal in der Dämmerung einen Container auf einen Lkw-Auflieger.",
      body: [
        { t: "h2", id: "ablauf", text: "Der Ablauf im Überblick" },
        {
          t: "p",
          text: "Ein Import aus China folgt fast immer denselben Schritten. Die Reihenfolge ist wichtig, denn viele Entscheidungen am Anfang bestimmen Kosten und Risiken am Ende.",
        },
        {
          t: "ol",
          items: [
            "Produkt und Anforderungen festlegen: Spezifikation, Qualität, Menge, Verpackung und die Vorschriften, die für das Produkt in der EU gelten.",
            "Einreihung und Abgaben klären: Zolltarifnummer, Zollsatz, mögliche Antidumping- oder Ausgleichszölle und Einfuhrumsatzsteuer.",
            "Lieferanten finden und prüfen: Angebote vergleichen, Muster prüfen, Unternehmen und Unterlagen kontrollieren.",
            "Vertrag und Lieferklausel vereinbaren: Preis, Zahlungsbedingungen, Qualitätskriterien und Incoterms®.",
            "Produktion und Qualitätskontrolle: Fertigung begleiten und die Ware vor dem Versand prüfen.",
            "Transport organisieren: See-, Bahn- oder Luftfracht, Versicherung und Ausfuhrabfertigung in China.",
            "Zollabfertigung in der EU: Zollanmeldung, Zahlung von Zoll und Einfuhrumsatzsteuer, Überlassung der Ware.",
            "Zustellung und Verkauf: Transport zum Lager, Wareneingangsprüfung und Start des Vertriebs.",
          ],
        },
        {
          t: "p",
          text: "Wie wir diese Schritte für unsere Kunden organisieren, zeigen wir auf unserer Seite zum [Import aus China](/import#ablauf).",
        },

        {
          t: "h2",
          id: "anforderungen",
          text: "Anforderungen klären, bevor Sie Angebote einholen",
        },
        {
          t: "p",
          text: "Der häufigste Grund für teure Überraschungen ist eine unklare Ausgangslage. Bevor Sie Lieferanten anfragen, sollten drei Fragen beantwortet sein.",
        },
        {
          t: "ul",
          items: [
            "Was genau soll geliefert werden? Material, Maße, Farben, Toleranzen, Verpackung und Kennzeichnung gehören in eine schriftliche Spezifikation. Sie ist später die Grundlage jeder Qualitätskontrolle.",
            "Welche Vorschriften gelten für das Produkt? Für Spielzeug, Elektrogeräte, Funkanlagen oder Lebensmittelkontaktmaterialien gelten jeweils eigene EU-Regeln. Sie bestimmen, welche Prüfberichte und Unterlagen der Hersteller liefern muss.",
            "Wie wird die Ware eingereiht? Die Zolltarifnummer entscheidet über den Zollsatz und darüber, ob besondere Maßnahmen wie Antidumpingzölle gelten. Wer sie erst bei Ankunft der Ware klärt, kalkuliert womöglich mit falschen Zahlen.",
          ],
        },

        { t: "h2", id: "lieferanten", text: "Lieferanten finden und prüfen" },
        {
          t: "p",
          text: "Ob über Fachmessen, Branchenkontakte oder Beschaffungsplattformen: Ein ansprechendes Angebot sagt noch wenig über die Zuverlässigkeit eines Lieferanten. Bewährt haben sich diese Prüfschritte.",
        },
        {
          t: "ul",
          items: [
            "Unternehmensdaten prüfen: Gewerbelizenz, eingetragener Firmenname und Geschäftszweck. Achten Sie darauf, ob Sie mit dem Hersteller selbst oder mit einem Handelsunternehmen sprechen.",
            "Muster bestellen und schriftlich freigeben: Das freigegebene Muster wird zum Maßstab für die Serienproduktion.",
            "Nachweise anfordern: Prüfberichte, Konformitätsunterlagen und Materialangaben, passend zu den Vorschriften für Ihr Produkt. Prüfen Sie, ob die Berichte zum konkreten Produkt gehören und von einer nachvollziehbaren Prüfstelle stammen.",
            "Fertigung und Ware kontrollieren: Eine Prüfung des Herstellers vor der Auftragsvergabe und eine Warenprüfung vor dem Versand senken das Risiko, fehlerhafte Ware zu bezahlen, bevor sie China verlässt.",
            "Klare Verträge schließen: Spezifikation, Qualitätskriterien, Liefertermin, Zahlungsplan und Lieferklausel sollten schriftlich vereinbart sein.",
          ],
        },

        {
          t: "h2",
          id: "incoterms",
          text: "Incoterms: Wer zahlt was bis wohin?",
        },
        {
          t: "p",
          text: "Die Lieferklausel im Kaufvertrag legt fest, welche Kosten der Lieferant trägt, wer die Formalitäten erledigt und wann das Risiko auf Sie übergeht. Maßgeblich sind die Incoterms® 2020 der Internationalen Handelskammer (ICC) mit elf Klauseln. Sie regeln weder den Eigentumsübergang noch die Zahlung. Beides gehört in den Kaufvertrag.",
        },
        {
          t: "table",
          caption: "Häufige Klauseln beim Import aus China, vereinfacht",
          head: [
            "Klausel",
            "Was der Lieferant übernimmt",
            "Was das für Sie bedeutet",
          ],
          rows: [
            [
              "EXW (Ab Werk)",
              "Stellt die Ware im Werk bereit",
              "Sie organisieren alles, auch die Ausfuhr in China. Ohne Partner vor Ort meist unpraktisch.",
            ],
            [
              "FCA (Frei Frachtführer)",
              "Übergibt die Ware an Ihren Frachtführer und erledigt die Ausfuhr",
              "Sie wählen Spediteur und Hauptlauf. Nach der ICC die passende Klausel für Container und kombinierte Transporte.",
            ],
            [
              "FOB (Frei an Bord)",
              "Liefert verladen auf das Schiff im Abgangshafen, einschließlich Ausfuhr",
              "Weit verbreitet, aber für Container weniger geeignet: Der Lieferant trägt das Risiko bis zur Verladung, auf die er im Terminal keinen Einfluss hat.",
            ],
            [
              "CIF / CIP",
              "Bezahlt Fracht und Versicherung bis zum Bestimmungsort",
              "Das Risiko geht trotzdem schon im Abgangsland auf Sie über.",
            ],
            [
              "DAP",
              "Liefert bis zum vereinbarten Ort, unverzollt",
              "Sie übernehmen Zollabfertigung und Einfuhrabgaben.",
            ],
            [
              "DDP",
              "Liefert verzollt und versteuert",
              "Der Lieferant übernimmt auch die Einfuhrabgaben in der EU. Prüfen Sie vorher, ob er das rechtlich und praktisch leisten kann.",
            ],
          ],
        },
        {
          t: "p",
          text: "Wichtig für die Kalkulation: Vergleichen Sie Angebote nur auf derselben Klausel. Ein niedriger Preis ab Werk kann am Ende teurer sein als ein FCA- oder FOB-Angebot, weil Vorlauf und Ausfuhrabfertigung in China hinzukommen.",
        },

        { t: "h2", id: "transport", text: "Transport: See, Bahn oder Luft" },
        {
          t: "p",
          text: "Welche Transportart passt, hängt von Menge, Wert, Gewicht und Termin der Ware ab. Die folgenden Laufzeiten sind unverbindliche Richtwerte für den Hauptlauf, keine zugesagten Lieferzeiten. Vor- und Nachlauf, Abfertigung, Feiertage und Engpässe in Häfen können die tatsächliche Dauer deutlich verlängern.",
        },
        {
          t: "table",
          caption:
            "Typische Laufzeiten im Hauptlauf, unverbindliche Richtwerte",
          head: ["Transportart", "Richtwert", "Geeignet für"],
          rows: [
            [
              "Seefracht",
              "etwa 30 bis 45 Tage",
              "Große Mengen und planbare Ware, als Vollcontainer (FCL) oder Sammelgut (LCL)",
            ],
            [
              "Bahnfracht",
              "etwa 18 bis 25 Tage",
              "Ware mit Termin, schneller als See und günstiger als Luft",
            ],
            [
              "Luftfracht",
              "etwa 3 bis 7 Tage",
              "Muster, Eilaufträge und hochwertige, leichte Produkte",
            ],
          ],
        },
        {
          t: "p",
          text: "Seit 2025 gilt das EU-Einfuhrkontrollsystem ICS2 für alle Verkehrsträger: Vor Ankunft der Ware werden Sicherheitsdaten an den Zoll übermittelt, darunter eine genaue Warenbeschreibung. In erster Linie ist dafür der Beförderer zuständig, in bestimmten Fällen auch der Empfänger in der EU. Geben Sie Ihrem Spediteur deshalb vollständige und genaue Warenangaben, sonst kann sich die Abfertigung verzögern. Einen Überblick über die Transportarten finden Sie auch auf unserer [Import-Seite](/import#imp-modes).",
        },

        {
          t: "h2",
          id: "eori",
          text: "Vor der ersten Einfuhr: die EORI-Nummer",
        },
        {
          t: "p",
          text: "Wer in der EU Zollanmeldungen abgibt oder abgeben lässt, braucht eine EORI-Nummer (Economic Operators' Registration and Identification). Sie ist rechtzeitig vor der ersten Tätigkeit zu beantragen, die unter das Zollrecht fällt.",
        },
        {
          t: "ul",
          items: [
            "Die Nummer wird kostenlos von der Generalzolldirektion, Dienstort Dresden, vergeben. Kostenpflichtige Drittanbieter sind dafür nicht nötig.",
            "Seit dem 1. Oktober 2026 ist das Zoll-Portal für Antrag, Änderung und Beendigung verpflichtend. Papierformulare sind nur noch im Ausfallverfahren zulässig, wenn das Portal nicht verfügbar ist.",
            "Für die Anmeldung im Zoll-Portal braucht Ihr Unternehmen eine ELSTER-Login-Option, zum Beispiel eine Zertifikatsdatei. Die Einrichtung kann dauern, planen Sie sie früh ein.",
          ],
        },

        { t: "h2", id: "zollanmeldung", text: "Die Zollanmeldung" },
        {
          t: "p",
          text: "In Deutschland werden Zollanmeldungen elektronisch über das IT-Verfahren ATLAS abgegeben. Die meisten Importeure beauftragen damit einen Spediteur oder Zolldienstleister. Dabei gibt es zwei Formen der Vertretung.",
        },
        {
          t: "ul",
          items: [
            "Direkte Vertretung: Der Dienstleister handelt in Ihrem Namen und für Ihre Rechnung. Er braucht dafür eine Vertretungsvollmacht.",
            "Indirekte Vertretung: Der Dienstleister handelt im eigenen Namen, aber für Ihre Rechnung. Er wird dann selbst als Anmelder für die Einfuhrabgaben in Anspruch genommen und muss die Unterlagen zur Einfuhr für Prüfungen bereithalten.",
          ],
        },
        {
          t: "p",
          text: "In jedem Fall müssen die Angaben zur Ware stimmen. Die wichtigste ist die Zolltarifnummer. Zollsätze und besondere Maßnahmen finden Sie im Elektronischen Zolltarif (EZT-online) und in der EU-Datenbank TARIC. Ist die Einreihung unklar, können Sie beim Zoll eine verbindliche Zolltarifauskunft (vZTA) beantragen. Sie gilt drei Jahre und gibt Sicherheit für künftige Einfuhren, nicht für bereits erfolgte.",
        },

        {
          t: "h2",
          id: "abgaben",
          text: "Zoll und Einfuhrumsatzsteuer berechnen",
        },
        { t: "h3", text: "Der Zollwert" },
        {
          t: "p",
          text: "Grundlage der Zollberechnung ist der Zollwert. In den meisten Fällen ist das der gezahlte oder zu zahlende Preis der Ware, zuzüglich der Beförderungs- und Versicherungskosten bis zum Ort, an dem die Ware in die EU gelangt. Beförderungskosten innerhalb der EU gehören nicht dazu. Bei Luftfracht wird nur ein pauschaler Anteil der Frachtkosten angesetzt, der sich nach der Abflugzone richtet. Weisen Rechnungen und Frachtrechnungen die Abschnitte nachvollziehbar aus, lässt sich der Zollwert sauber belegen.",
        },
        { t: "h3", text: "Der Zollsatz" },
        {
          t: "p",
          text: "China wurde zum 1. Januar 2015 aus dem Allgemeinen Präferenzsystem der EU gestrichen. Für Waren mit Ursprung in China gilt deshalb in der Regel der normale Drittlandszollsatz, der je nach Ware sehr unterschiedlich ist. Für einzelne Waren gelten zusätzlich Antidumping- oder Ausgleichszölle, teils mit unterschiedlichen Sätzen je Hersteller. Ein Beispiel sind Elektrofahrräder aus China: Die EU hat die 2019 eingeführten Maßnahmen im Januar 2025 um fünf Jahre verlängert. Prüfen Sie deshalb in TARIC immer auch die Maßnahmen zu Ihrer Warennummer, bevor Sie bestellen.",
        },
        {
          t: "note",
          title: "Seit 1. Juli 2026: keine Zollfreiheit mehr bis 150 Euro",
          text: "Die frühere Befreiung von Einfuhrabgaben für Sendungen mit einem Gesamtwert bis 150 Euro ist mit Wirkung zum 1. Juli 2026 entfallen (Verordnung (EU) 2026/382). Übergangsweise gilt vom 1. Juli 2026 bis zum 1. Juli 2028 stattdessen ein pauschaler Zoll von 3 Euro je Ware in Sendungen mit einem Sachwert von höchstens 150 Euro, aber nur unter einer von zwei Voraussetzungen: Die Einfuhr ist über den Import-One-Stop-Shop (IOSS) von der Einfuhrumsatzsteuer befreit, oder die Waren sind in einer Postsendung im zollrechtlichen Sinn enthalten. Für Letzteres kommt es nach Auskunft des Zolls darauf an, dass es sich um Fernverkäufe handelt. Der deutsche Zoll erhebt die 3 Euro je Warenkategorie, also je Position der Zollanmeldung. Seit dem 1. November 2026 kommt bei Fernabsatzsendungen eine Bearbeitungsgebühr der Union von 2 Euro je Warenkategorie hinzu. Gewerbliche Einfuhren für Ihr Unternehmen fallen nicht unter diese Pauschale und werden nach dem regulären Zollsatz verzollt.",
        },
        { t: "h3", text: "Die Einfuhrumsatzsteuer" },
        {
          t: "p",
          text: "Zusätzlich erhebt der Zoll die Einfuhrumsatzsteuer (EUSt). Sie beträgt 19 Prozent oder, für begünstigte Waren, 7 Prozent. Bemessungsgrundlage ist grundsätzlich der Zollwert. Hinzu kommen der Zoll und andere Abgaben sowie die Beförderungskosten von der EU-Grenze bis zum ersten Bestimmungsort in der EU.",
        },
        {
          t: "p",
          text: "Ein Rechenbeispiel des deutschen Zolls zeigt die Systematik. Der Zollsatz von 2 Prozent ist darin fiktiv.",
        },
        {
          t: "table",
          caption:
            "Rechenbeispiel nach Zoll online, vereinfacht. Es ersetzt keine Berechnung für Ihre Ware.",
          head: ["Position", "Betrag"],
          rows: [
            ["Rechnungspreis ab Werk", "10.000,00 €"],
            ["+ Frachtkosten bis Rotterdam", "1.200,00 €"],
            ["= Zollwert", "11.200,00 €"],
            ["Zoll (fiktiver Satz 2 %)", "224,00 €"],
            ["+ Beförderungskosten Rotterdam bis Berlin", "300,00 €"],
            ["= Bemessungsgrundlage der EUSt", "11.724,00 €"],
            ["Einfuhrumsatzsteuer (19 %)", "2.227,56 €"],
          ],
        },
        {
          t: "p",
          text: "Unternehmen mit Recht zum Vorsteuerabzug können die EUSt für Waren, die für ihr Unternehmen eingeführt wurden, als Vorsteuer geltend machen. Nachweis ist der Einfuhrabgabenbescheid. Bis zur Verrechnung ist das Geld aber gebunden. Ist beim Zoll ein Zahlungsaufschub bewilligt, wird die EUSt erst am 26. des zweiten Monats nach dem Monat der Einfuhr fällig. Ob sich ein eigenes Aufschubkonto lohnt, hängt vom Einfuhrvolumen ab.",
        },

        {
          t: "h2",
          id: "produktpflichten",
          text: "Produktpflichten: Was vor dem Verkauf erfüllt sein muss",
        },
        {
          t: "p",
          text: "Mit der Einfuhr werden Sie in vielen Fällen zum ersten Verantwortlichen für das Produkt in der EU. Die folgenden Pflichten sind voneinander getrennt. Welche davon für Ihr Produkt gelten, hängt von der Ware und vom Abnehmer ab.",
        },
        { t: "h3", text: "Allgemeine Produktsicherheit (GPSR)" },
        {
          t: "p",
          text: "Seit dem 13. Dezember 2024 gilt die Verordnung (EU) 2023/988 über die allgemeine Produktsicherheit (GPSR). Sie erfasst Produkte, die für Verbraucher bestimmt sind oder voraussichtlich von Verbrauchern benutzt werden, und wirkt als Auffangregelung: Legt das EU-Recht für ein Produkt spezifische Sicherheitsanforderungen fest, gilt die GPSR nur für die Aspekte und Risiken, die dort nicht geregelt sind.",
        },
        {
          t: "p",
          text: "Für Verbraucherprodukte ohne spezifische EU-Harmonisierungsvorschriften müssen Importeure nach Artikel 11 GPSR unter anderem:",
        },
        {
          t: "ul",
          items: [
            "vor dem Inverkehrbringen sicherstellen, dass das Produkt sicher ist und der Hersteller technische Unterlagen erstellt sowie das Produkt und seine Kontaktdaten gekennzeichnet hat,",
            "ihren Namen, ihren eingetragenen Handelsnamen oder ihre eingetragene Marke sowie ihre Post- und E-Mail-Adresse angeben, und zwar auf dem Produkt oder, wenn das nicht möglich ist, auf der Verpackung oder in einer Begleitunterlage,",
            "klare Anweisungen und Sicherheitsinformationen in einer für Verbraucher leicht verständlichen Sprache beifügen, die der jeweilige Mitgliedstaat festlegt,",
            "eine Kopie der technischen Unterlagen zehn Jahre lang für die Marktüberwachung bereithalten,",
            "bei einem gefährlichen Produkt unverzüglich Korrekturmaßnahmen sicherstellen und die Behörden über das Safety Business Gateway informieren.",
          ],
        },
        {
          t: "p",
          text: "Für alle Verbraucherprodukte, auch solche mit CE-Kennzeichnung, gilt außerdem: Wer sie online anbietet, muss im Angebot unter anderem den Hersteller, gegebenenfalls die verantwortliche Person in der EU, Angaben zur Identifizierung des Produkts mit einer Abbildung sowie Warnhinweise nennen.",
        },
        { t: "h3", text: "CE-Kennzeichnung" },
        {
          t: "p",
          text: "Die CE-Kennzeichnung ist keine allgemeine Pflicht, sondern gilt nur für Produkte, die unter bestimmte EU-Harmonisierungsvorschriften fallen, zum Beispiel Spielzeug, viele Elektrogeräte oder Funkanlagen. Für diese Produkte ergeben sich die Importeurpflichten aus der jeweiligen Vorschrift statt aus Artikel 11 GPSR. Sie folgen einem einheitlichen EU-Muster: Importeure müssen vor dem Inverkehrbringen sicherstellen, dass der Hersteller die Konformitätsbewertung durchgeführt und die technischen Unterlagen erstellt hat, dass das Produkt die CE-Kennzeichnung trägt und die nötigen Unterlagen beiliegen. Auch hier geben Importeure ihren Namen und ihre Kontaktanschrift auf dem Produkt an, ersatzweise auf Verpackung oder Begleitunterlagen, und halten eine Abschrift der Konformitätserklärung für die Marktüberwachung bereit.",
        },
        { t: "h3", text: "Verpackungen" },
        {
          t: "p",
          text: "Seit dem 12. August 2026 gelten die EU-Verpackungsverordnung (PPWR) und das deutsche Verpackungsrecht-Durchführungsgesetz (VerpackDG). Sie haben das bisherige Verpackungsgesetz abgelöst. Für Verpackungen in Deutschland ist in der Regel das erste Unternehmen der inländischen Lieferkette verantwortlicher Hersteller. Lässt ein Unternehmen Produkte unter eigener Marke fertigen, ist es nach dem Markenprinzip selbst Hersteller. Hersteller müssen im Verpackungsregister LUCID registriert sein, für bestimmte Verpackungen kommen Systembeteiligung und Mengenmeldungen hinzu.",
        },
        { t: "h3", text: "Produktspezifische Vorschriften" },
        {
          t: "ul",
          items: [
            "Elektro- und Elektronikgeräte: Wer Geräte aus einem Drittland erstmals in Deutschland anbietet, gilt nach dem ElektroG als Hersteller und muss sich vor dem Inverkehrbringen bei der stiftung ear registrieren. Für Batterien gelten eigene Registrierungspflichten, ebenfalls bei der stiftung ear.",
            "CO₂-Grenzausgleich (CBAM): Für Waren aus den Bereichen Zement, Eisen und Stahl, Aluminium, Düngemittel, Strom und Wasserstoff gilt seit 1. Januar 2026 die endgültige Phase. Von den Pflichten befreit ist, wer im Kalenderjahr insgesamt höchstens 50 Tonnen Eigenmasse solcher Waren einführt, gerechnet über alle betroffenen Warennummern. Diese Ausnahme gilt nicht für Strom und Wasserstoff. Wer die Schwelle überschreitet, unterliegt den Pflichten für alle in diesem Jahr eingeführten CBAM-Waren und darf sie nur als zugelassener CBAM-Anmelder einführen. Die erste CBAM-Erklärung mit Abgabe der Zertifikate für 2026 ist bis zum 30. September 2027 fällig.",
            "Entwaldungsfreie Lieferketten (EUDR): Für Rinder, Kakao, Kaffee, Ölpalme, Kautschuk, Soja und Holz sowie bestimmte daraus hergestellte Erzeugnisse, die in Anhang I der Verordnung (EU) 2023/1115 aufgeführt sind, gelten ab dem 30. Dezember 2026 Sorgfaltspflichten. Die Sorgfaltserklärung gibt das Unternehmen ab, das ein Erzeugnis erstmals in der EU in Verkehr bringt. Kleinst- und Kleinunternehmen, die am 31. Dezember 2024 als solche niedergelassen waren, müssen die Pflichten erst ab dem 30. Juni 2027 erfüllen, ausgenommen Holzerzeugnisse, die bereits unter die EU-Holzhandelsverordnung fielen.",
            "Weitere Vorschriften: Je nach Produkt kommen etwa Beschränkungen für Chemikalien oder besondere Anforderungen an Lebensmittelkontaktmaterialien hinzu.",
          ],
        },
        {
          t: "p",
          text: "Stellen die zuständigen Behörden bei der Einfuhr fest, dass Unterlagen oder Kennzeichnungen fehlen oder ein Produkt ein Risiko darstellt, setzen sie die Überlassung der Ware aus. Produktpflichten gehören deshalb an den Anfang des Projekts, nicht an das Ende.",
        },

        { t: "h2", id: "dokumente", text: "Die wichtigsten Dokumente" },
        {
          t: "table",
          head: ["Dokument", "Wozu es dient"],
          rows: [
            [
              "Handelsrechnung",
              "Grundlage, auf der der Zollwert angemeldet wird. Sie sollte Verkäufer, Käufer, Warenbeschreibung, Menge, Preis, Währung und Lieferklausel enthalten.",
            ],
            [
              "Zollwertanmeldung",
              "Angaben, die den Zollwert beeinflussen. Der Zoll kann darauf verzichten, etwa wenn der Zollwert 20.000 Euro je Sendung nicht übersteigt.",
            ],
            [
              "Packliste",
              "Inhalt, Gewicht und Maße je Packstück. Wichtig für Transport, Kontrolle und Wareneingang.",
            ],
            [
              "Transportdokument",
              "Konnossement (Bill of Lading) bei Seefracht, Luftfrachtbrief bei Luftfracht, Frachtbrief bei Bahnfracht.",
            ],
            [
              "Ursprungsnachweis",
              "Eine Zollpräferenz für Waren aus China gibt es nicht. Ein Nachweis des Ursprungs kann aber zum Beispiel bei Antidumpingmaßnahmen nötig sein.",
            ],
            [
              "Konformitätsunterlagen",
              "Konformitätserklärung, Prüfberichte und technische Unterlagen, soweit für das Produkt vorgeschrieben.",
            ],
            [
              "Vertretungsvollmacht",
              "Für die Zollanmeldung durch einen Dienstleister in direkter Vertretung.",
            ],
            [
              "Zahlungs- und Frachtbelege",
              "Belegen den gezahlten Preis und die Beförderungskosten, wenn der Zoll Nachweise verlangt.",
            ],
          ],
        },
        {
          t: "p",
          text: "Alle Unterlagen, die für das Zollverfahren nötig sind, müssen bei Abgabe der Zollanmeldung vorliegen und auf Verlangen vorgelegt werden, auch wenn ATLAS sie nicht automatisch anfordert.",
        },

        { t: "h2", id: "kosten", text: "Kosten realistisch kalkulieren" },
        {
          t: "p",
          text: "Seriöse Pauschalpreise für einen Import aus China gibt es nicht. Was eine Lieferung kostet, ergibt sich aus vielen Einzelpositionen. Manche stehen vorab fest, andere ändern sich mit Markt, Saison und Verlauf der Lieferung. Die Übersicht hilft, keine Position zu vergessen.",
        },
        {
          t: "table",
          caption: "Kostenbestandteile und wovon sie abhängen",
          head: ["Kostenbestandteil", "Wovon er abhängt"],
          rows: [
            ["Warenpreis", "Menge, Spezifikation, Material und Verhandlung"],
            [
              "Muster und Prüfungen",
              "Produktart, Anzahl der Muster, geforderte Prüfberichte",
            ],
            [
              "Qualitätskontrolle vor dem Versand",
              "Umfang der Prüfung und Ort der Fertigung",
            ],
            [
              "Vorlauf und Ausfuhr in China",
              "Lieferklausel und Entfernung zum Hafen oder Terminal",
            ],
            [
              "Hauptlauf (See, Bahn, Luft)",
              "Transportart, Volumen, Gewicht und aktuelle Marktpreise",
            ],
            ["Transportversicherung", "Warenwert und Deckungsumfang"],
            [
              "Hafen- und Terminalkosten",
              "Hafen, Containertyp und Verweildauer",
            ],
            [
              "Zollabfertigung durch Dienstleister",
              "Anzahl der Positionen und Aufwand der Anmeldung",
            ],
            [
              "Zoll",
              "Zolltarifnummer, Zollwert, mögliche Antidumping- oder Ausgleichszölle",
            ],
            [
              "Einfuhrumsatzsteuer",
              "Zollwert, Zoll und Beförderungskosten. In der Regel als Vorsteuer abziehbar, aber zunächst zu zahlen",
            ],
            ["Nachlauf bis zum Lager", "Entfernung und Art der Zustellung"],
            [
              "Lagergeld und Standgeld für Container",
              "Verzögerungen bei Abfertigung oder Abholung",
            ],
            [
              "Registrierungen und Lizenzen",
              "Produktart, zum Beispiel Verpackungen, Elektrogeräte oder Batterien",
            ],
            [
              "Wechselkurs und Zahlungsverkehr",
              "Währung, Zahlungsziel und Bankgebühren",
            ],
          ],
        },
        {
          t: "p",
          text: "Planen Sie außerdem einen Puffer für Verzögerungen ein. Standzeiten im Hafen verursachen schnell Zusatzkosten. Eine Einschätzung für Ihre konkrete Lieferung erhalten Sie über unser [Angebotsformular](/quote).",
        },

        {
          t: "h2",
          id: "fehler",
          text: "Häufige Fehler und wie Sie sie vermeiden",
        },
        {
          t: "ul",
          items: [
            "Die Zolltarifnummer wird zu spät geklärt. Die Kalkulation stimmt dann womöglich nicht, und Antidumpingzölle fallen erst bei der Einfuhr auf.",
            "Angebote werden auf unterschiedlichen Lieferklauseln verglichen. Rechnen Sie alle Angebote auf dieselbe Basis um.",
            "Produktpflichten werden erst nach Ankunft geprüft. Fehlen Unterlagen, Kennzeichnung oder Registrierung, kann die Ware festgehalten werden oder darf nicht verkauft werden.",
            "Die Spezifikation ist nur mündlich vereinbart. Ohne schriftliche Vorgaben und freigegebenes Muster lassen sich Mängel kaum durchsetzen.",
            "Der Rechnungswert ist zu niedrig angegeben. Ein falscher Zollwert führt zu Nachforderungen und Ärger bei späteren Prüfungen.",
            "Die Einfuhrumsatzsteuer fehlt in der Liquiditätsplanung. Auch wenn sie als Vorsteuer zurückkommt, muss sie zuerst bezahlt werden.",
            "Es gibt keinen Zeitpuffer. Feiertage in China, Engpässe in Häfen und Kontrollen verlängern Lieferzeiten.",
          ],
        },

        { t: "h2", id: "fazit", text: "Fazit" },
        {
          t: "p",
          text: "Ein Import aus China ist gut planbar, wenn die Grundlagen am Anfang stehen: eine klare Spezifikation, die richtige Zolltarifnummer, geprüfte Lieferanten, eine passende Lieferklausel und erfüllte Produktpflichten. Wer diese Punkte vor der ersten Bestellung klärt, kalkuliert verlässlicher und vermeidet die meisten teuren Überraschungen.",
        },
        {
          t: "p",
          text: "Luna Trading begleitet Unternehmen von der Lieferantensuche über Qualitätskontrolle und Transport bis zur Verzollung. Welche Leistungen wir anbieten, sehen Sie unter [Leistungen](/what-we-do).",
        },
      ],
      sources: importChinaSources("de"),
    },
    en: importChinaEn,
    ar: importChinaAr,
  },
};
