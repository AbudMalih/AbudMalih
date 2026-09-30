# JARBOU Logistik GmbH – Website (Neubau)

Neubau der Website von JARBOU Logistik GmbH. **Phase 1:** Designsystem, Architektur, Startseite und die Scroll-Sequenz „Vom Lager zum Ziel“.
Alle anderen Routen sind als ehrliche „In Vorbereitung“-Seiten angelegt (`noindex`, nicht in der Sitemap), damit keine Navigation ins Leere führt.

> Das alte Prototyp-Projekt im Repository-Root (`/app`, `/components`, `/lib` …) ist **nicht** Teil dieses Neubaus und kann nach Freigabe entfernt werden.

## Stack

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16 (App Router, statisch vorgerendert), React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, Design-Tokens in `src/app/globals.css` |
| Motion | GSAP + ScrollTrigger (nur für die Scroll-Sequenz, wird erst beim ersten Scrollen geladen), sonst CSS |
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

## Inhalte pflegen (`src/content`)

Alle Inhalte liegen typisiert in `src/content/*.ts` (`types.ts` beschreibt das Modell). Die Struktur ist so gewählt, dass später ein Headless-CMS die Module ersetzen kann, ohne Komponenten anzufassen. **Ein CMS ist noch nicht angebunden.**

| Datei | Inhalt | Hinweis |
|---|---|---|
| `company.ts` | Firmendaten & Kennzahlen (2019, 160+, 180+, 25) | Nur bestätigte Zahlen eintragen |
| `locations.ts` | Bremen, Hannover, Köln, Magdeburg, Kassel, Haiger, Erfurt, Suhl, Zwickau | `type: null` = noch nicht bestätigt → nur der Ortsname wird angezeigt |
| `jobs.ts` | Fahrer DHL Express Hannover, Disponent Hannover | `status: "published"` + `validThrough` steuern Sichtbarkeit |
| `services.ts` | 6 Leistungen + 5 Prozessschritte | |
| `media.ts` | Bild-Slots für Leistungen | Alle `placeholder: true` – siehe unten |
| `partners.ts` | Partnerlogos | Sektion erscheint erst mit `publicUseApproved: true` + Logo-Datei |
| `quality.ts` | Qualitäts-Regelkreis + „Was wir messen“ | Prozessbeschreibung, keine Kennzahlen. Echte KPIs erst nach Freigabe und Datenanbindung |
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

## DSGVO

- Cookie-Banner unterscheidet *notwendig / Statistik / Marketing*. Aktuell sind **keine** optionalen Dienste eingebunden (`optionalTechnologies` in `src/lib/consent.ts` ist leer); neue Dienste dürfen nur über diese Liste geladen werden.
- Impressum und Datenschutz sind **Platzhalter** und müssen von JARBOU geliefert und rechtlich geprüft werden.

## Offene Punkte (von JARBOU zu liefern / zu bestätigen)

| Was | Wo | Warum |
|---|---|---|
| Produktionsdomain | `NEXT_PUBLIC_SITE_URL` (siehe `.env.example`) | Canonical-URLs, Sitemap, Open Graph. Standard aktuell `https://www.jarbou-logistik.com` |
| Impressum-Angaben, Anschrift, Telefon, Registergericht | `src/content/company.ts`, Impressum-Seite | Gesetzliche Pflicht (§ 5 DDG) |
| Datenschutzerklärung | Datenschutz-Seite | Rechtlich geprüfter Text nötig |
| E-Mail für Geschäfts- und allgemeine Anfragen | `company.email` | Nur `karriere@jarbou-logistik.com` ist bekannt |
| Standort-Klassifizierung | `locations.ts` | Welche Orte sind Logistikstandort / Projekt / Einsatzgebiet? |
| Freigabe DHL-Express-Logo | `partners.ts` | Logo nur mit schriftlicher Freigabe |
| Fotos (Mitarbeitende, Fahrzeuge, Betrieb) | `media.ts` | Ersetzen die schematischen Grafiken |
| Firmen-Meilensteine seit 2019 | folgt mit `/unternehmen` | Keine erfundenen Meilensteine |

## Phase 2 (nach Freigabe der Startseite)

`/unternehmen`, `/leistungen`, `/standorte` (große interaktive Karte), `/karriere` inkl. Jobseiten `/karriere/jobs/[slug]` mit JobPosting-Schema, Quick-Apply und vollständige Bewerbung (React Hook Form + Zod), `/business` mit Anfrageformular, `/kontakt` mit getrennten Wegen. Für den Formularversand wird ein E-Mail-Adapter (SMTP oder API-Dienst) mit serverseitigen Umgebungsvariablen benötigt.
