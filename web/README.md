# JARBOU Logistik GmbH – Website (Neubau)

**Phase 1** (freigegeben): Designsystem, Startseite, 40-t-Sattelzug-Scroll-Sequenz.
**Phase 2**: Unternehmen, Leistungen, Standorte, Karriere-Plattform mit Stellenseiten und Online-Bewerbung, Initiativbewerbung, Business mit Projektanfrage, Kontakt, Formular-Backend.

> Das alte Prototyp-Projekt im Repository-Root (`/app`, `/components`, `/lib` …) ist **nicht** Teil dieses Neubaus und kann nach Freigabe entfernt werden.

## Stack

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16 (App Router, statisch vorgerendert), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, Design-Tokens in `src/app/globals.css` |
| Motion | GSAP + ScrollTrigger (nur für die Scroll-Sequenz, wird erst beim ersten Scrollen geladen), sonst CSS |
| Formulare | React Hook Form + Zod (gemeinsame Schemas für Browser und Server), Route Handler unter `/api/*` |
| E-Mail | Adapter mit SMTP-Treiber (nodemailer) – siehe „E-Mail-Versand“ |
| Schriften | Inter Tight (Headlines & Text), Geist Mono (Labels) – via `next/font`, selbst gehostet |

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint
npm run typecheck
```

## Struktur

```
src/
  app/                     Routen, Layout, robots.ts, sitemap.ts, icon.svg
  components/
    brand/                 Logo (offizielle Datei), Slashes (exakte Logo-Geometrie)
    layout/                Header, Footer, Cookie-Consent, Seitenübergang, PendingPage
    ui/                    Button, SectionLabel, StatRow
    data/                  Deutschlandkarte
    illustrations/         Schematische Platzhalter-Grafiken für Leistungen
  sections/home/           Startseiten-Sektionen
    journey/               Scroll-Sequenz: geometry.ts, Truck.tsx, JourneyScene.tsx, JourneySequence.tsx
  content/                 ZENTRALE, TYPISIERTE INHALTE (CMS-fähig)
  motion/                  InView-Reveal, Count-up
  lib/                     Consent, Structured Data, Geo-Projektion
public/brand/              Logo (SVG hell/dunkel + Originaldatei)
```

## Seiten

| Route | Inhalt | Index |
|---|---|---|
| `/` | Startseite mit Scroll-Sequenz | ja |
| `/unternehmen` | Geschichte 2019 → heute, Kapitel, Grundsätze | ja |
| `/leistungen` | Sechs Leistungen im Detail mit Scroll-Index | ja |
| `/standorte` | Interaktive Karte mit Filter, Detailansicht, offenen Stellen | ja |
| `/karriere` | Jobs mit Filter, Warum JARBOU, Ein Tag bei JARBOU, Bewerbungsprozess, Entwicklung, Standorte, FAQ | ja |
| `/karriere/jobs/[slug]` | Stellenseite + Bewerbung + JobPosting-Schema | ja |
| `/karriere/bewerben?stelle=…` | Kurz- oder vollständige Bewerbung | ja |
| `/karriere/initiativbewerbung` | Initiativbewerbung (5 Schritte) | ja |
| `/business` | B2B-Seite + Projektanfrage | ja |
| `/kontakt` | Geschäft / Karriere / Allgemein getrennt | ja |
| `/impressum`, `/datenschutz` | Platzhalter bis zur rechtlichen Freigabe | **nein** |

## Inhalte pflegen (`src/content`)

Alle Inhalte liegen typisiert in `src/content/*.ts` (`types.ts` beschreibt das Modell). Die Struktur ist so gewählt, dass später ein Headless-CMS die Module ersetzen kann, ohne Komponenten anzufassen. **Ein CMS ist noch nicht angebunden.**

| Datei | Inhalt | Hinweis |
|---|---|---|
| `company.ts` | Firmendaten & Kennzahlen (2019, 160+, 180+, 25) | Nur bestätigte Zahlen eintragen |
| `locations.ts` | Bremen, Hannover, Köln, Magdeburg, Kassel, Haiger, Erfurt, Suhl, Zwickau | `type: null` = noch nicht bestätigt → nur der Ortsname wird angezeigt |
| `jobs.ts` | Fahrer DHL Express Hannover, Disponent Hannover | `status: "published"` + `validThrough` steuern Sichtbarkeit; Filter, Sitemap, JobPosting und Formularoptionen leiten sich automatisch ab. Leere Listen (z. B. Anforderungen) werden ausgeblendet. |
| `services.ts` | 6 Leistungen + 5 Prozessschritte | |
| `media.ts` | Bild-Slots für Leistungen | Alle `placeholder: true` – siehe unten |
| `partners.ts` | Partnerlogos | Sektion erscheint erst mit `publicUseApproved: true` + Logo-Datei |
| `quality.ts` | Qualitäts-Regelkreis + „Was wir messen“ | Prozessbeschreibung, keine Kennzahlen. Echte KPIs erst nach Freigabe und Datenanbindung |
| `careers.ts` | Karriere-Texte, Bewerbungsprozess, „Ein Tag bei JARBOU“, Entwicklungspfad, Führerscheinklassen | |
| `faqs.ts` | Bewerber-FAQ (sichtbar + FAQPage-Schema) | Keine Gehalts- oder Zeitversprechen |
| `stories.ts` | Mitarbeitergeschichten | Leer. Anzeige nur mit `published` + `publicationPermission` |
| `business.ts` | B2B-Texte, Projektstart, Formularoptionen | Keine Kundenreferenzen ohne Freigabe |
| `company.ts` | Fakten, Unternehmensseite, Zeitleiste | Weitere Meilensteine als `published: false` anlegen und erst nach Prüfung veröffentlichen |
| `navigation.ts`, `site.ts` | Navigation, SEO-Basis | |

### Standort-Typen
`office | warehouse | logistics_site | project | operational_area | recruiting_location`. Hannover und Kassel sind als `project` (DHL Express) hinterlegt; alle anderen Standorte stehen bis zur Bestätigung auf `null`.

## Assets austauschen

- **Logo:** `public/brand/jarbou-logo.svg` (dunkel), `jarbou-logo-white.svg` (hell) – vektorisiert aus der gelieferten Datei `jarbou-logo-original.jpg`. Liegt eine Original-Vektordatei der Agentur vor, bitte diese beiden Dateien ersetzen.
- **Leistungsfotos:** In `src/content/media.ts` `src` setzen und `placeholder: false`. Bis dahin werden schematische Grafiken gezeigt (keine Fotos, keine erfundenen Standorte/Personen).
- **Sattelzug in der Scroll-Sequenz:** 40-t-Sattelzug als maßstabsgetreue Vektor-Illustration (1 m = 64 Einheiten, ca. 16,7 m) in `journey/Truck.tsx` – bewusst keinem Hersteller nachempfunden. Eine freigegebene Seitenansicht (transparente PNG/SVG, ca. 1070 × 256 Einheiten) kann über `<JourneyScene truckAsset={…} />` eingesetzt werden; Räder und Lichter bleiben animierbar.
- **Karte:** Natural Earth 1:10m (Public Domain), projiziert in `src/lib/geo/germany.ts`.

## Barrierefreiheit & Motion

- `prefers-reduced-motion`: Die Scroll-Sequenz wird zu einem statischen Bild plus Claim und Kennzahlen, alle Reveals sind sofort sichtbar.
- Ohne JavaScript sind alle Inhalte sichtbar (Reveals greifen nur mit `html.js`).
- Kennzahlen stehen vollständig im HTML; das Hochzählen startet einmalig und endet immer auf dem exakten Wert.
- Normaler System-Cursor, kein Scroll-Hijacking (die Sequenz nutzt `position: sticky` mit normalem Scrollen).

## E-Mail-Versand (Formulare)

Alle Formulare senden serverseitig über `src/lib/mail` (SMTP via nodemailer). Zugangsdaten stehen ausschließlich in Umgebungsvariablen des Hostings – nie im Code, nie im Browser.

**Produktion (one.com):** `SMTP_HOST=send.one.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, dazu `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (Absender = Postfach von `SMTP_USER` oder dessen Alias). Vorlage: `.env.example`.

| Formular | Endpoint | Empfänger-Variable |
|---|---|---|
| Kurz-, vollständige und Initiativbewerbung | `POST /api/bewerbung` | `CAREER_RECIPIENT` (Standard `karriere@jarbou-logistik.com`) |
| Projektanfrage | `POST /api/geschaeftsanfrage` | `BUSINESS_RECIPIENT` – **noch offen** |
| Allgemeiner Kontakt | `POST /api/kontakt` | `GENERAL_RECIPIENT` – **noch offen** |

- **E-Mails:** gebrandete, einfache HTML-Mails + Textversion (`src/lib/mail/templates.ts`) mit Art, Eingang (Datum/Uhrzeit), Referenz, Kontakt, allen Feldern, Anhängen und Zeitpunkt der Einwilligung. „Antworten“ geht direkt an die Absenderin/den Absender (Reply-To). Bewerberinnen und Bewerber erhalten **keine** automatischen E-Mails.
- **Ohne Konfiguration** melden die Formulare „Online-Versand derzeit nicht verfügbar“ (bei Bewerbungen mit Hinweis auf karriere@jarbou-logistik.com). Nichts wird vorgetäuscht.
- **Entwicklung:** `MAIL_DRIVER=log` versendet nichts, sondern legt eine HTML-Vorschau im Temp-Ordner ab (in Produktion deaktiviert).

### Sicherheit der Formulare
Zod-Validierung im Browser **und** auf dem Server, Längenbegrenzungen, Upload-Prüfung (Endung + Datei-Signatur, max. 10 MB/Datei, 5 Dateien, 20 MB gesamt), bereinigte Dateinamen, Honeypot + Mindest-Ausfüllzeit, Rate-Limit je Formular und IP, Same-Origin-Prüfung, Schutz vor Doppel-Absendungen, HTML-Escaping in E-Mails, bereinigte Mail-Header. Server-Logs enthalten nur technische Fehlercodes – keine Formularinhalte, Namen oder Adressen. Einsendungen und Dokumente werden **nicht gespeichert**, nur per E-Mail zugestellt.

### Aufbewahrung von Bewerberdaten
`APPLICANT_RETENTION_DAYS` ist bewusst **leer**. Erst wenn die Frist in der Datenschutzerklärung festgelegt ist, eintragen – dann enthält jede Bewerbungs-E-Mail das konkrete Löschdatum.

## Rechtliches (Impressum & Datenschutz)

Inhalte in `src/content/legal.ts`. Fehlende Angaben sind dort als `null` markiert und werden nicht angezeigt; solange `approved: false` gilt, zeigen beide Seiten einen neutralen Hinweis und bleiben `noindex` (auch nicht in der Sitemap). Für die Datenschutzerklärung ist u. a. ein Abschnitt „Bewerbungen“ vorbereitet.

**Technische Fakten für die Rechtsprüfung:** keine Analyse- oder Marketing-Dienste; ein technisch notwendiger Eintrag im Browser (`localStorage`, Cookie-Auswahl); Formulare: Kontakt, Projektanfrage, Kurz-/vollständige/Initiativbewerbung mit den im Formular sichtbaren Feldern und optionalen Dokumenten; Übermittlung per verschlüsselter SMTP-Verbindung an die konfigurierten Postfächer (one.com); keine Datenbank-Speicherung auf der Website; Schriften werden selbst gehostet (keine Verbindung zu Google).

## Domain & SEO

Kanonische Domain: `https://www.jarbou-logistik.com`. Aufrufe von `jarbou-logistik.com` leiten dauerhaft (308) auf `www` um; HTTP→HTTPS übernimmt das Hosting. Canonical-Tags, Open Graph, Sitemap, robots.txt und strukturierte Daten (Organization, JobPosting, FAQPage, BreadcrumbList) nutzen `NEXT_PUBLIC_SITE_URL`.

## Fotos (echte JARBOU-Aufnahmen)

In `src/content/media.ts` sind Plätze für LKW, Transporter, Fahrer, Disposition, Standorte, Büro, Team und Beladung vorbereitet (`photo-*`). Ein Platz erscheint erst, wenn `src` gesetzt und `placeholder: false` ist – ohne Fotos bleibt das Layout vollständig. Keine KI-generierten Personen, keine beliebigen Stockfotos.

## DSGVO

- Cookie-Banner unterscheidet *notwendig / Statistik / Marketing*. Aktuell sind **keine** optionalen Dienste eingebunden (`optionalTechnologies` in `src/lib/consent.ts` ist leer); neue Dienste dürfen nur über diese Liste geladen werden.
- Impressum und Datenschutz sind **Platzhalter** und müssen von JARBOU geliefert und rechtlich geprüft werden.

## Offene Punkte (von JARBOU zu liefern / zu bestätigen)

| Was | Wo | Warum |
|---|---|---|
| Produktionsdomain | `NEXT_PUBLIC_SITE_URL` (siehe `.env.example`) | Canonical-URLs, Sitemap, Open Graph. Standard aktuell `https://www.jarbou-logistik.com` |
| SMTP-Passwort + Absenderpostfach (one.com) | Hosting-Umgebung (`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) | Ohne diese Daten werden keine Formulare zugestellt |
| Aufbewahrungsfrist Bewerberdaten | `APPLICANT_RETENTION_DAYS` + Datenschutzerklärung | Muss übereinstimmen |
| Impressum-Angaben, Anschrift, Telefon, Registergericht | `src/content/company.ts`, Impressum-Seite | Gesetzliche Pflicht (§ 5 DDG) |
| Datenschutzerklärung | Datenschutz-Seite | Rechtlich geprüfter Text nötig |
| E-Mail für Geschäfts- und allgemeine Anfragen | `company.email` (Anzeige) + `BUSINESS_RECIPIENT` / `GENERAL_RECIPIENT` (Versand) | Nur `karriere@jarbou-logistik.com` ist bekannt |
| Adresse/PLZ des Einsatzorts Hannover | `jobs.ts` → `address` | Verbessert das JobPosting-Schema (optional) |
| Gültigkeitsdatum der Stellen | `jobs.ts` → `validThrough` | Von Google empfohlen |
| Mitarbeitergeschichten mit Einwilligung | `stories.ts` | Sektion erscheint erst dann |
| Standort-Klassifizierung | `locations.ts` | Welche Orte sind Logistikstandort / Projekt / Einsatzgebiet? |
| Freigabe DHL-Express-Logo | `partners.ts` | Logo nur mit schriftlicher Freigabe |
| Fotos (Mitarbeitende, Fahrzeuge, Betrieb) | `media.ts` | Ersetzen die schematischen Grafiken |
| Firmen-Meilensteine seit 2019 | folgt mit `/unternehmen` | Keine erfundenen Meilensteine |
