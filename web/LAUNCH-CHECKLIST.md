# Launch-Freigabe – JARBOU Logistik Website

Diese Liste wird **vor dem Umschalten der Domain** und danach bei jeder
größeren Änderung abgearbeitet. Jeder Punkt wird von der zuständigen Person
bei JARBOU freigegeben (Name + Datum eintragen). Nichts davon wird von der
Entwicklung „angenommen“ – fehlt eine Freigabe, bleibt der Inhalt
ausgeblendet bzw. als Platzhalter markiert.

Legende: `[ ]` offen · `[x]` freigegeben · **Pflicht** = blockiert den Launch

---

## 1. Rechtliches (Pflicht)

| # | Punkt | Wo | Freigabe (Name, Datum) |
|---|---|---|---|
| 1.1 | [ ] Impressum vollständig: Firma, Anschrift, Vertretungsberechtigte, Registergericht + HRB, USt-IdNr., Kontakt (§ 5 DDG) | `src/content/legal.ts`, `src/content/company.ts` | |
| 1.2 | [ ] Datenschutzerklärung rechtlich geprüft (inkl. Abschnitt „Bewerbungen“, SMTP-Zustellung über one.com, keine Analyse-/Marketingdienste, `localStorage` für Cookie-Auswahl, selbst gehostete Schriften, Vercel als Hosting) | `src/content/legal.ts` | |
| 1.3 | [ ] `approved: true` für Impressum und Datenschutz erst nach 1.1 + 1.2 setzen (sonst `noindex` + Hinweis) | `src/content/legal.ts` | |
| 1.4 | [ ] Aufbewahrungsfrist Bewerberdaten festgelegt und identisch in Datenschutzerklärung und `APPLICANT_RETENTION_DAYS` | Vercel-Umgebung + `legal.ts` | |
| 1.5 | [ ] Cookie-Banner geprüft: nur „notwendig“ aktiv, `optionalTechnologies` leer (kein GA, kein Meta Pixel, keine Ad-Tracker) | `src/lib/consent.ts` | |

## 2. Unternehmensangaben & Kennzahlen (Pflicht)

| # | Punkt | Wo | Freigabe |
|---|---|---|---|
| 2.1 | [ ] Gründungsjahr und Kennzahlen bestätigt (aktuell 2019, 160+, 180+, 25) | `src/content/company.ts` | |
| 2.2 | [ ] Zeitleiste: nur geprüfte Meilensteine mit `published: true` | `src/content/company.ts` | |
| 2.3 | [ ] Standorte: Typ je Ort bestätigt (Logistikstandort / Projekt / Einsatzgebiet …); unbestätigte bleiben `type: null` | `src/content/locations.ts` | |
| 2.4 | [ ] Leistungstexte und Prozessschritte freigegeben | `src/content/services.ts` | |
| 2.5 | [ ] Qualitätsseite: nur Prozessbeschreibung, keine Kennzahlen ohne Freigabe | `src/content/quality.ts` | |
| 2.6 | [ ] B2B-Texte freigegeben, keine Kundenreferenzen ohne schriftliche Zustimmung | `src/content/business.ts` | |

## 3. Karriere & Stellenanzeigen (Pflicht)

Eine Stelle ist nur öffentlich, wenn **`status: "published"` UND
`confirmed: true`** gesetzt sind (und `validThrough` nicht abgelaufen ist).
Das gilt automatisch für Jobbörse, Detailseiten, Sitemap, JobPosting-Daten,
die Positionsauswahl im Bewerbungsformular und die Bewerbungs-API.

| # | Punkt | Wo | Freigabe |
|---|---|---|---|
| 3.1 | [ ] Jede veröffentlichte Stelle ist eine **echte, offene Vakanz** und von der Geschäftsführung bestätigt (`confirmed: true`) | `src/content/jobs.ts` | |
| 3.2 | [ ] Titel, Ort, Beschäftigungsart, Startdatum, Aufgaben, Anforderungen und Benefits je Stelle geprüft | `src/content/jobs.ts` | |
| 3.3 | [ ] Gehalt nur eintragen, wenn freigegeben (sonst `salary: null` → wird ausgeblendet) | `src/content/jobs.ts` | |
| 3.4 | [ ] `validThrough` je Stelle gesetzt oder bewusst leer | `src/content/jobs.ts` | |
| 3.5 | [ ] Adresse/PLZ des Einsatzorts (optional, verbessert JobPosting) | `src/content/jobs.ts` → `address` | |
| 3.6 | [ ] Bewerber-FAQ ohne Gehalts- oder Zeitversprechen | `src/content/faqs.ts` | |
| 3.7 | [ ] Mitarbeitergeschichten nur mit schriftlicher Einwilligung (`publicationPermission` + `published`) | `src/content/stories.ts` | |

**Neue Stelle veröffentlichen:** Eintrag mit `status: "draft"` und
`confirmed: false` anlegen → Inhalte freigeben lassen → `status: "published"`,
`confirmed: true`, `datePosted` setzen → Build prüfen → committen.
**Stelle beenden:** `status: "archived"` (oder `validThrough` setzen).

## 4. Marken, Logos & Bilder (Pflicht)

| # | Punkt | Wo | Freigabe |
|---|---|---|---|
| 4.1 | [ ] JARBOU-Logo: Originalvektor der Agentur eingesetzt oder die vektorisierte Version freigegeben | `public/brand/` | |
| 4.2 | [ ] Partnerlogos nur mit schriftlicher Freigabe (`publicUseApproved: true`); **DHL-Express-Logo wird nicht verwendet** | `src/content/partners.ts` | |
| 4.3 | [ ] Fotos nur echte JARBOU-Aufnahmen mit Rechten/Einwilligungen; keine KI-Personen, keine beliebigen Stockfotos | `src/content/media.ts` | |
| 4.4 | [ ] Scroll-Film (Sattelzug) in der Endfassung abgenommen – Desktop und Mobil | `public/journey/` | |
| 4.5 | [ ] Open-Graph-Bild und Favicon geprüft | `src/app/` | |

## 5. Formulare & E-Mail-Zustellung (Pflicht)

| # | Punkt | Wo | Freigabe |
|---|---|---|---|
| 5.1 | [ ] SMTP-Zugang in Vercel hinterlegt (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) – nur in Vercel, nie im Code | Vercel → Settings → Environment Variables (Production) | |
| 5.2 | [ ] Empfänger bestätigt: `CAREER_RECIPIENT`, `BUSINESS_RECIPIENT`, `GENERAL_RECIPIENT` | Vercel-Umgebung | |
| 5.3 | [ ] Testbewerbung (Kurz, vollständig mit Anhang, initiativ) kommt vollständig an; „Antworten“ geht an die Absenderin/den Absender | Live-Test | |
| 5.4 | [ ] Test-Projektanfrage und Test-Kontaktanfrage kommen an | Live-Test | |
| 5.5 | [ ] Zustellung landet nicht im Spam (SPF/DKIM der Absenderdomain beim Mail-Anbieter geprüft) | DNS / one.com | |
| 5.6 | [ ] Bestätigt: Bewerber erhalten **keine** automatischen oder Marketing-E-Mails; Dokumente werden nicht gespeichert; Server-Logs ohne Bewerberdaten | Code-Review | |

## 6. Technik, Qualität & Barrierefreiheit

| # | Punkt | Prüfung | Freigabe |
|---|---|---|---|
| 6.1 | [ ] `npm run lint`, `npm run typecheck`, `npm run build` fehlerfrei (Ordner `web/`) | lokal / Vercel-Build | |
| 6.2 | [ ] Alle Seiten auf Desktop, Tablet und Smartphone geprüft (Chrome, Safari iOS, Firefox, Edge) | manuell | |
| 6.3 | [ ] Scroll-Film flüssig auf aktuellem iPhone, Android-Mittelklasse und Laptop | manuell | |
| 6.4 | [ ] `prefers-reduced-motion`: statisches Bild statt Film, alle Inhalte sichtbar | System-Einstellung | |
| 6.5 | [ ] Tastaturbedienung, Fokus sichtbar, Formular-Fehlermeldungen werden vorgelesen | manuell / Screenreader | |
| 6.6 | [ ] Lighthouse (mobil): Performance, Accessibility, Best Practices, SEO geprüft | Chrome DevTools | |
| 6.7 | [ ] 404-Seite und Fehlerseite geprüft | manuell | |
| 6.8 | [ ] Sicherheits-Header aktiv (CSP, HSTS u. a.) | `next.config.ts`, securityheaders.com | |

## 7. Domain, SEO & Vercel (Pflicht)

| # | Punkt | Wo | Freigabe |
|---|---|---|---|
| 7.1 | [ ] Vercel: Root Directory `web`, Framework Next.js, Build/Output Standard, **Production Branch `main`** | Vercel → Settings | |
| 7.2 | [ ] `NEXT_PUBLIC_SITE_URL=https://www.jarbou-logistik.com` in Production | Vercel-Umgebung | |
| 7.3 | [ ] DNS umgestellt: `A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`; **MX-Einträge unverändert** | Domain-Anbieter | |
| 7.4 | [ ] Vercel zeigt beide Domains als „Valid Configuration“, HTTPS-Zertifikat aktiv | Vercel → Domains | |
| 7.5 | [ ] `jarbou-logistik.com` leitet auf `www` um (308) | Browser | |
| 7.6 | [ ] E-Mail-Empfang nach DNS-Umstellung weiterhin funktionsfähig | Test-Mail | |
| 7.7 | [ ] Sitemap (`/sitemap.xml`) und `robots.txt` erreichbar; in der Google Search Console eingereicht | Search Console | |
| 7.8 | [ ] Vercel-Bereitstellungsschutz (Vercel Authentication) für Preview-Deployments aktiv, Produktionsdomain öffentlich | Vercel → Deployment Protection | |

## 8. Nach dem Launch (erste Woche)

- [ ] Erste echte Bewerbung und Anfrage sind angekommen
- [ ] Vercel-Laufzeitfehler (Runtime Logs) geprüft – keine Formularinhalte in Logs
- [ ] Google Search Console: Indexierung und JobPosting-Ergebnisse ohne Fehler
- [ ] Offene Punkte aus `README.md` → „Offene Punkte“ nachgezogen

---

**Gesamtfreigabe Launch:** ______________________ (Geschäftsführung) · Datum: __________
