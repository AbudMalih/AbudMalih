import type { Article } from "../types";

/**
 * DRAFT (Phase 3B, article 1). German only. Every legal or regulatory
 * statement was checked against the official sources listed in `sources`
 * on the review date (8 November 2026). Costs are named as components only:
 * no prices are stated. Transport times are the same indicative ranges as on
 * the Import page. Not to be published before final approval.
 */
export const importChina: Article = {
  id: "import-china",
  category: "import",
  status: "draft",
  published: "2026-11-08",
  updated: "2026-11-08",
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
          text: "Die frühere Befreiung von Einfuhrabgaben für Sendungen mit einem Gesamtwert bis 150 Euro wurde mit Wirkung zum 1. Juli 2026 gestrichen. Ein pauschaler Zoll von 3 Euro je Warenkategorie gilt nur für bestimmte Fernabsatzsendungen bis 150 Euro, etwa über den Import-One-Stop-Shop. Gewerbliche Einfuhren für Ihr Unternehmen werden nach dem regulären Zollsatz verzollt.",
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
          text: "Seit dem 13. Dezember 2024 gilt die Verordnung (EU) 2023/988 über die allgemeine Produktsicherheit für Verbraucherprodukte. Importeure müssen unter anderem ihren Namen, ihren eingetragenen Handelsnamen oder ihre eingetragene Marke sowie ihre Post- und E-Mail-Adresse angeben, und zwar auf dem Produkt oder, wenn das nicht möglich ist, auf der Verpackung oder in einer Begleitunterlage. Dazu kommen eine Gebrauchsanleitung und Sicherheitsinformationen in einer für Verbraucher leicht verständlichen Sprache, die der jeweilige Mitgliedstaat festlegt, sowie die Pflicht, eine Kopie der technischen Unterlagen zehn Jahre lang für die Marktüberwachung bereitzuhalten.",
        },
        { t: "h3", text: "CE-Kennzeichnung" },
        {
          t: "p",
          text: "Die CE-Kennzeichnung ist keine allgemeine Pflicht, sondern gilt nur für Produkte, die unter bestimmte EU-Harmonisierungsvorschriften fallen, zum Beispiel Spielzeug, viele Elektrogeräte oder Funkanlagen. Für diese Produkte müssen Importeure vor dem Inverkehrbringen sicherstellen, dass der Hersteller die Konformitätsbewertung durchgeführt und die technischen Unterlagen erstellt hat, dass das Produkt die CE-Kennzeichnung trägt und die nötigen Unterlagen beiliegen. Eine Abschrift der Konformitätserklärung müssen Sie für die Marktüberwachung bereithalten.",
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
            "CO₂-Grenzausgleich (CBAM): Für Waren aus den Bereichen Zement, Eisen und Stahl, Aluminium, Düngemittel, Strom und Wasserstoff gilt seit 1. Januar 2026 die endgültige Phase. Wer mehr als 50 Tonnen solcher Waren im Jahr einführt, braucht den Status als zugelassener CBAM-Anmelder. Die erste CBAM-Erklärung mit Abgabe der Zertifikate ist bis 30. September 2027 fällig.",
            "Entwaldungsfreie Lieferketten (EUDR): Für Rinder, Kakao, Kaffee, Ölpalme, Kautschuk, Soja und Holz sowie bestimmte daraus hergestellte Erzeugnisse gilt eine Sorgfaltspflicht. Große und mittlere Unternehmen müssen sie ab dem 30. Dezember 2026 erfüllen, Kleinst- und Kleinunternehmen ab dem 30. Juni 2027.",
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
      sources: [
        {
          title:
            "Beantragung einer EORI-Nummer und Änderung der Beteiligtendaten",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Zoelle/EORI-Nummer/Beantragung-einer-EORI-Nummer/beantragung-einer-eori-nummer_node.html",
        },
        {
          title: "Onlineverpflichtung ab 1. Oktober 2026 für EORI-Formulare",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/SharedDocs/Fachmeldungen/Aktuelle-Einzelmeldungen/2026/azr_onlineverpflichtung_eori_formulare_ab_20261001.html",
        },
        {
          title: "Vertretung im Zollrecht",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zollanmeldung/Vertretung/vertretung_node.html",
        },
        {
          title: "Zollanmeldung: notwendige Unterlagen",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zollanmeldung/Notwendige-Unterlagen/notwendige-unterlagen_node.html",
        },
        {
          title:
            "Verbindliche Zolltarifauskunft: Antrag, Erteilung, Gültigkeit",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zolltarif/verbindliche-Zolltarifauskunft/Antrag-Erteilung-Gueltigkeit/antrag-erteilung-gueltigkeit_node.html",
        },
        {
          title: "Zollwert: Beförderungs- und Versicherungskosten",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Zoelle/Zollwert/Methoden-der-Zollwertermittlung/Transaktionswert-fuer-die-eingefuehrte-Ware/Berichtigungen-Artikel-71-72-UZK/Befoerderungs-und-Versicherungskosten/befoerderungs-und-versicherungskosten_node.html",
        },
        {
          title: "Wegfall der 150-Euro-Zollfreigrenze",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Zoelle/Wegfall-der-150-Euro-Zollfreigrenze/wegfall-der-150-euro-zollfreigrenze_node.html",
        },
        {
          title: "Einfuhrumsatzsteuer: Bemessungsgrundlage",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Steuern/Einfuhrumsatzsteuer/Bemessungsgrundlage/bemessungsgrundlage_node.html",
        },
        {
          title: "Berechnung von Einfuhrabgaben (Rechenbeispiel)",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Steuern/Einfuhrumsatzsteuer/Bemessungsgrundlage/marginalspalte_beispiel_faq.html?faqCalledDoc=132938",
        },
        {
          title: "Einfuhrumsatzsteuer: Vorsteuerabzug",
          publisher: "Zoll online, Generalzolldirektion",
          url: "https://www.zoll.de/DE/Fachthemen/Steuern/Einfuhrumsatzsteuer/Vorsteuerabzug/vorsteuerabzug_node.html",
        },
        {
          title:
            "§ 21 Umsatzsteuergesetz: Besondere Vorschriften für die Einfuhrumsatzsteuer",
          publisher: "Bundesministerium der Justiz, gesetze-im-internet.de",
          url: "https://www.gesetze-im-internet.de/ustg_1980/__21.html",
        },
        {
          title:
            "Delegierte Verordnung (EU) Nr. 1421/2013 (Streichung Chinas aus dem Allgemeinen Präferenzsystem)",
          publisher: "EUR-Lex, Amt für Veröffentlichungen der EU",
          url: "https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32013R1421",
        },
        {
          title: "EU extends duties on electric bicycles from China",
          publisher: "Europäische Kommission, GD Handel",
          url: "https://policy.trade.ec.europa.eu/news/eu-extends-duties-electric-bicycles-china-2025-01-24_en",
        },
        {
          title: "Access2Markets: Zölle und Maßnahmen nach Warennummer",
          publisher: "Europäische Kommission",
          url: "https://trade.ec.europa.eu/access-to-markets/de/home",
        },
        {
          title: "ICS2 extends to rail and road transportation from April 2025",
          publisher: "Europäische Kommission, GD Steuern und Zollunion",
          url: "https://taxation-customs.ec.europa.eu/news/eu-import-control-system-2-ics2-extends-rail-and-road-transportation-april-2025-2025-02-03_en",
        },
        {
          title: "Incoterms® rules",
          publisher: "Internationale Handelskammer (ICC)",
          url: "https://iccwbo.org/business-solutions/incoterms-rules/",
        },
        {
          title: "Incoterms® 2020: FCA or FOB?",
          publisher: "ICC Academy",
          url: "https://academy.iccwbo.org/incoterms/article/incoterms-2020-fca-or-fob/",
        },
        {
          title:
            "Verordnung (EU) 2023/988 über die allgemeine Produktsicherheit",
          publisher: "EUR-Lex, Amt für Veröffentlichungen der EU",
          url: "https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R0988",
        },
        {
          title:
            "Beschluss Nr. 768/2008/EG über einen gemeinsamen Rechtsrahmen für die Vermarktung von Produkten",
          publisher: "EUR-Lex, Amt für Veröffentlichungen der EU",
          url: "https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32008D0768",
        },
        {
          title:
            "Verordnung (EU) 2019/1020 über Marktüberwachung und die Konformität von Produkten",
          publisher: "EUR-Lex, Amt für Veröffentlichungen der EU",
          url: "https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32019R1020",
        },
        {
          title: "PPWR und VerpackDG: Das gilt seit dem 12. August 2026",
          publisher: "Zentrale Stelle Verpackungsregister",
          url: "https://www.verpackungsregister.org/ich-moechte-wissen-was-seit-dem-12-august-2026-gilt",
        },
        {
          title:
            "§ 3 Elektro- und Elektronikgerätegesetz: Begriffsbestimmungen",
          publisher: "Bundesministerium der Justiz, gesetze-im-internet.de",
          url: "https://www.gesetze-im-internet.de/elektrog_2015/__3.html",
        },
        {
          title: "§ 6 Elektro- und Elektronikgerätegesetz: Registrierung",
          publisher: "Bundesministerium der Justiz, gesetze-im-internet.de",
          url: "https://www.gesetze-im-internet.de/elektrog_2015/__6.html",
        },
        {
          title: "stiftung elektro-altgeräte register",
          publisher: "stiftung ear",
          url: "https://www.stiftung-ear.de",
        },
        {
          title: "Carbon Border Adjustment Mechanism",
          publisher: "Europäische Kommission, GD Steuern und Zollunion",
          url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
        },
        {
          title: "CBAM: communication and FAQs",
          publisher: "Europäische Kommission, GD Steuern und Zollunion",
          url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-communication-and-faqs_en",
        },
        {
          title: "Regulation on Deforestation-free Products",
          publisher: "Europäische Kommission, GD Umwelt",
          url: "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en",
        },
        {
          title:
            "Delay until December 2026 and other developments in the implementation of the EUDR",
          publisher: "Europäische Kommission, Access2Markets",
          url: "https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation",
        },
      ],
    },
  },
};
