# Jarbou Logistik GmbH – Corporate Website

Professionelle, produktionsreife Website für Jarbou Logistik GmbH — ein deutsches Logistikunternehmen mit Sitz in Erfurt.

## Tech-Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion** (Animationen)
- **Lucide React** (Icons)

## Installation

```bash
npm install
```

## Entwicklung

```bash
npm run dev
```

Die Website läuft unter [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```

## Typprüfung & Linting

```bash
npm run type-check
npm run lint
```

## Projektstruktur

```
app/                      # Next.js App Router Seiten
  page.tsx                # Startseite
  leistungen/             # Leistungen
  fuer-unternehmen/       # B2B-Seite mit Anfrage-Formular
  qualitaet/              # Qualität & Technologie
  ueber-uns/              # Über uns
  karriere/               # Karriere-Landingpage
  jobs/                   # Stellenliste
  jobs/[id]/              # Dynamische Stellendetails
  bewerbung/              # Bewerbungsformular
  initiativbewerbung/     # Initiativbewerbung
  kontakt/                # Kontaktseite
  impressum/              # Impressum
  datenschutz/            # Datenschutzerklärung
  not-found.tsx           # 404-Seite
components/               # React-Komponenten
  Header.tsx              # Sticky Header mit Navigation
  Footer.tsx              # Footer
  Logo.tsx                # Logo-Komponente (Platzhalter!)
  CookieConsent.tsx       # Cookie-Banner
  sections/               # Homepage-Sektionen
  forms/                  # Formulare (B2B, Bewerbung)
lib/
  data.ts                 # ZENTRALE DATENQUELLE (CMS-ready)
```

## Zentrale Datenverwaltung

Alle Inhalte werden zentral in `lib/data.ts` verwaltet:

- **companyStats** – Unternehmenskennzahlen (Mitarbeiter, Fahrzeuge, Umsatz, Qualitätswerte)
- **services** – Leistungen
- **locations** – Standorte (mit Aktiv-/Recruiting-Status)
- **jobs** – Stellenangebote (Demo-Inhalte!)
- **faqs** – Karriere-FAQ
- **companyValues** – Unternehmenswerte
- **companyTimeline** – Firmengeschichte
- **contactInfo** – Kontaktdaten

### Statistiken aktualisieren

`lib/data.ts` → `companyStats` bearbeiten.

### Jobs verwalten (Status-Workflow)

Alle Stellen leben in `lib/data.ts` → `jobs`. Die vier enthaltenen Einträge sind **wiederverwendbare Rollenvorlagen** (Fahrer/Kurier, Disponent, Teamleiter/Standortleiter, Qualität & Reporting) mit `internalLabel: 'Beispielposition – derzeit nicht veröffentlicht'` — **keine echten Vakanzen**.

Jede Stelle hat zwei Sichtbarkeits-Felder:

| Feld | Werte | Bedeutung |
|---|---|---|
| `status` | `draft` / `active` / `paused` / `closed` | Workflow-Status |
| `confirmed` | `true` / `false` | Freigabe durch die Geschäftsführung |

**Öffentlich erscheint eine Stelle nur bei `status: 'active'` UND `confirmed: true`** (gefiltert über `publishedJobs`). Das gilt für die Stellenliste, die Detailseite, das Bewerbungsformular, die Sitemap und das JobPosting-Schema — Entwürfe erzeugen niemals Strukturdaten.

**Eine Stelle veröffentlichen:**
1. Vorlage kopieren, `id` und Inhalte anpassen
2. Freigegebene Werte eintragen: `location`, `type`, `schedule`, `startDate`, ggf. `salary`, `benefits`, `clientName` (bleiben sonst `null` und werden automatisch ausgeblendet)
3. `published` auf das heutige Datum setzen, optional `expiryDate`
4. `status: 'active'` und `confirmed: true` setzen

**Wichtig:** Gehälter, exakte Standorte, Arbeitszeiten, Kundennamen und Benefits erst eintragen, wenn sie freigegeben wurden. Ohne veröffentlichte Stellen zeigt die Jobs-Seite automatisch einen gepflegten Leerzustand mit „Initiativ bewerben“-Button.

Dasselbe Freigabeprinzip gilt für `locations`: `recruiting` und `roles` erst nach Bestätigung füllen.

### Standorte aktualisieren

`lib/data.ts` → `locations`. Felder: `active` (öffentlich sichtbar), `recruiting` (Recruiting-Badge), `roles` (gesuchte Positionen).

## Assets: Automatische Erkennung

Die Website erkennt offizielle Assets **automatisch** (siehe `lib/assets.ts`). Legen Sie die Dateien einfach in `/public` ab und bauen Sie neu — kein Code-Change nötig:

| Asset | Pfad | Verhalten |
|---|---|---|
| **Offizielles Logo** | `/public/logo.svg` (oder `logo.png`) | Wird automatisch in Header und Footer gerendert (Original-Proportionen, nur höhenbeschränkt). Bis dahin: strukturierter Wortmarken-Fallback — niemals ein Broken-Image-Icon. |
| **Hero-Video** | `/public/jarbou-hero.mp4` (auch `hero.mp4`/`.webm`) | Automatisch als stummes Cinematic-Loop-Video mit Poster. |
| **Hero-Poster** | `/public/jarbou-hero-poster.jpg` | Poster-Bild für das Hero-Video. |
| **Hero-Bild** | `/public/jarbou-hero.jpg` (auch `.avif`/`.webp`, oder `hero.*`) | Automatisch als Hero-Hintergrund mit dunklem Overlay (Video hat Vorrang vor Bild). |
| OG-Image | `/public/og-image.jpg` | 1200×630 für Social Sharing |
| Favicon | `/public/favicon.ico` | Aus dem Logo abgeleitet |
| Flotten-/Team-Fotos | `/public/images/` | Echte Fotos von Fahrzeugen, Team, Dispatch |

**Status:** Logo, Favicon und OG-Image sind vorhanden. Hero-Medien und Foto-Material müssen noch bereitgestellt werden — bis dahin zeigt der Hero bewusst den dunklen Gradient-Fallback (kein generisches Autobahn-, Schiffs- oder Flugzeugbild).

### Hero ersetzen — Schritt für Schritt

1. **Bild:** Datei als `/public/jarbou-hero.jpg` ablegen (empfohlen: ≥ 2000 px Breite, komprimiert, authentische Jarbou-Aufnahme). Alternativ `.webp`/`.avif`.
2. **Oder Video:** Datei als `/public/jarbou-hero.mp4` ablegen (10–15 s Loop, stumm, web-komprimiert, ideal ≤ 8 MB) plus Poster-Bild als `/public/jarbou-hero-poster.jpg`.
3. Neu bauen (`npm run build`) — der Hero verwendet das Medium automatisch, inklusive dunklem Overlay für Textlesbarkeit. **Kein Code-Change, kein Redesign nötig.** Liegt ein Video UND ein Bild vor, gewinnt das Video.
4. Datei löschen → der Gradient-Fallback kehrt automatisch zurück.

**Bildausschnitt für Desktop und Mobile steuern:**

In `lib/data.ts` → `heroMediaConfig` lassen sich die CSS-`object-position`-Werte getrennt für Mobil und Desktop setzen — z. B. um auf dem Smartphone ein Fahrzeug im Bildzentrum zu halten:

```ts
export const heroMediaConfig = {
  mobilePosition: '30% center',   // Handy: Fokus weiter links
  desktopPosition: 'center center',
}
```

Gültige Werte: `center`, `top`, `bottom`, `left`, `right`, Prozentwerte (`'30% 40%'`) und Kombinationen (`'center top'`). Mobil greift bis 767 px Breite, Desktop ab 768 px.

## Launch-Checkliste (Freigabe erforderlich)

Vor dem Livegang müssen folgende Inhalte geprüft und freigegeben werden:

- [ ] Offizielles Logo eingebunden
- [ ] Aktuelle Unternehmenskennzahlen (Mitarbeiter, Fahrzeuge, Umsatz)
- [ ] Aktuelle Standorte (welche sind öffentlich sichtbar?)
- [ ] Aktive Stellenangebote (Demo-Jobs entfernen/ersetzen!)
- [ ] Partner-Logos: Rechtliche Freigabe erforderlich (Amazon, Hermes, DHL)
- [ ] Leistungswerte (96% Zustellqualität etc.) freigegeben
- [ ] Benefits je Position und Standort geprüft
- [ ] Kontakt-E-Mail-Adressen bestätigt
- [ ] Hero-Bildmaterial freigegeben
- [ ] Mitarbeiter-Testimonials nur mit Einwilligung
- [ ] ADR-Verfügbarkeit je Standort geprüft

## Rechtlicher Hinweis

**Die Rechtstexte (Impressum, Datenschutzerklärung) sind Vorlagen und MÜSSEN vor dem Launch von qualifiziertem deutschem Rechtsbeistand geprüft werden.** Insbesondere:

- Impressum: Geschäftsführer, Handelsregisternummer, USt-ID ergänzen
- Datenschutzerklärung: DSGVO-konforme Prüfung durch Fachanwalt
- Cookie-Consent: Rechtliche Prüfung des Consent-Modells

## Formulare & Backend

Alle drei Formulare (Bewerbung, Initiativbewerbung, B2B-Anfrage) sind an produktionsreife API-Routen angebunden:

| Formular | API-Route | Empfänger |
|---|---|---|
| Bewerbung | `POST /api/apply` (type=job) | `CAREER_EMAIL` (Standard: karriere@jarbou-logistik.com) |
| Initiativbewerbung | `POST /api/apply` (type=initiative) | `CAREER_EMAIL` |
| B2B-Anfrage | `POST /api/business-inquiry` | `BUSINESS_INQUIRY_EMAIL` (**Pflicht in Produktion**) |

### Setup

1. `.env.example` nach `.env.local` kopieren
2. `BUSINESS_INQUIRY_EMAIL` und SMTP-Zugangsdaten eintragen (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`)
3. Ohne SMTP-Konfiguration werden Übermittlungen **im Entwicklungsmodus** in die Server-Konsole geloggt; **in Produktion** schlagen sie mit klarer Fehlermeldung fehl (keine stillen Datenverluste)

### Eingebaute Sicherheit

- **Server-seitige Validierung** aller Felder mit Zod (zusätzlich zur Client-Validierung)
- **Upload-Validierung**: Dateityp (Endung + MIME), max. 10 MB pro Datei, max. 5 Dateien; Dateinamen werden bereinigt; Dateien werden nie auf Platte geschrieben, sondern direkt als E-Mail-Anhang weitergeleitet
- **Rate Limiting**: 5 Anfragen pro 15 Minuten pro IP (In-Memory; für horizontale Skalierung `lib/rate-limit.ts` auf Redis umstellen)
- **Honeypot-Feld** gegen Spam-Bots
- **Consent-Log**: Zeitstempel der Datenschutz-Einwilligung wird in jeder Übermittlung dokumentiert
- Keine Formularinhalte in Analytics

## Zukünftige CMS-Integration

Die Datenstruktur in `lib/data.ts` ist so aufgebaut, dass sie später einfach an ein Headless CMS (z. B. Sanity, Strapi, Payload) angebunden werden kann. Die typisierten Interfaces können direkt als CMS-Schema-Vorlage dienen.

## Demo-Inhalte

**Achtung:** Die Stellenangebote in `lib/data.ts` sind Demo-Inhalte und müssen vor dem Launch durch echte Vakanzen ersetzt werden.
