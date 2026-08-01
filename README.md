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

### Jobs hinzufügen/entfernen

`lib/data.ts` → `jobs` Array bearbeiten. Setzen Sie `status: 'closed'`, um eine Stelle zu deaktivieren.

### Standorte aktualisieren

`lib/data.ts` → `locations`. Felder: `active` (öffentlich sichtbar), `recruiting` (Recruiting-Badge), `roles` (gesuchte Positionen).

## WICHTIG: Fehlende Assets

Die folgenden Assets fehlen und müssen ergänzt werden:

| Asset | Pfad | Beschreibung |
|---|---|---|
| **Offizielles Logo** | `/public/logo.svg` | Das offizielle Jarbou-Logo. Aktuell zeigt `components/Logo.tsx` einen Platzhalter (zwei rote Slashes als SVG). Ersetzen Sie die Komponente durch ein `<Image>` mit dem offiziellen Logo. |
| Hero-Bild/Video | `/public/hero.jpg` | Authentische Logistik-Aufnahme (keine generische Autobahn!) |
| OG-Image | `/public/og-image.jpg` | 1200×630 für Social Sharing |
| Favicon | `/public/favicon.ico` | Aus dem Logo abgeleitet |
| Flotten-/Team-Fotos | `/public/images/` | Echte Fotos von Fahrzeugen, Team, Dispatch |

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

## Formulare

Die Formulare (B2B-Anfrage, Bewerbung) sind aktuell Frontend-only (console.log). Für den Produktivbetrieb:

1. API-Route erstellen (`app/api/...`)
2. E-Mail-Versand konfigurieren (z. B. Resend, SendGrid)
3. Empfänger-Adressen als Umgebungsvariablen
4. Server-seitige Validierung ergänzen
5. Rate Limiting und Spam-Schutz (z. B. hCaptcha)
6. DSGVO-konforme Speicherung mit Consent-Log

## Zukünftige CMS-Integration

Die Datenstruktur in `lib/data.ts` ist so aufgebaut, dass sie später einfach an ein Headless CMS (z. B. Sanity, Strapi, Payload) angebunden werden kann. Die typisierten Interfaces können direkt als CMS-Schema-Vorlage dienen.

## Demo-Inhalte

**Achtung:** Die Stellenangebote in `lib/data.ts` sind Demo-Inhalte und müssen vor dem Launch durch echte Vakanzen ersetzt werden.
