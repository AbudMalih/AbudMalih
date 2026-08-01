// Company Statistics
export const companyStats = {
  founded: 2020,
  employees: 135,
  vehicles: 143,
  locations: 7,
  revenue: '9+ Million €',
  growth: '+575%',
  deliveryQuality: '96%',
  pickupQuality: '98.8%',
  stopsPerRoute: '46.8',
  targetStopsPerRoute: '45',
}

// Services
export const services = [
  {
    id: 'paketzustellung',
    title: 'Paketzustellung',
    category: 'Delivery & Pickup',
    description: 'Zuverlässige Paketzustellung in Deutschland mit täglichem Reporting und Zeitfenster-Management.',
  },
  {
    id: 'abholtouren',
    title: 'Abholtouren',
    category: 'Delivery & Pickup',
    description: 'Pünktliche Abholdienste mit vollständiger Sendungsdokumentation.',
  },
  {
    id: 'cep',
    title: 'CEP-Dienstleistungen',
    category: 'Delivery & Pickup',
    description: 'Kurier-, Express- und Paketdienstleistungen für Unternehmen aller Größen.',
  },
  {
    id: 'express',
    title: 'Express-Touren',
    category: 'Delivery & Pickup',
    description: 'Schnelle und zuverlässige Express-Lösungen mit garantierten Zustellzeiten.',
  },
  {
    id: 'disposition',
    title: 'Eigene Disposition',
    category: 'Dispatch & Control',
    description: 'Vollständig integrierte Tourenplanung und Flottensteuerung in-house.',
  },
  {
    id: 'tourenplanung',
    title: 'Tourenplanung',
    category: 'Dispatch & Control',
    description: 'Effiziente Routenoptimierung und dynamische Tourensteuerung.',
  },
  {
    id: 'qualitaetsreporting',
    title: 'Qualitätsreporting',
    category: 'Quality & Technology',
    description: 'Tägliche automatisierte Qualitätsberichte und Performance-Analysen.',
  },
  {
    id: 'datenanalyse',
    title: 'KI-gestützte Datenanalyse',
    category: 'Quality & Technology',
    description: 'Intelligente Auswertung von Leistungsdaten für kontinuierliche Optimierung.',
  },
]

// Locations
export const locations = [
  {
    id: 'erfurt',
    city: 'Erfurt',
    state: 'Thüringen',
    country: 'Deutschland',
    address: 'Erfurter Landstraße 50a, 99095 Erfurt',
    lat: 50.9789,
    lng: 11.0234,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Hauptstandort',
  },
  {
    id: 'berlin',
    city: 'Berlin',
    state: 'Berlin',
    country: 'Deutschland',
    address: 'Berlin',
    lat: 52.5200,
    lng: 13.4050,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Operativ',
  },
  {
    id: 'hamburg',
    city: 'Hamburg',
    state: 'Hamburg',
    country: 'Deutschland',
    address: 'Hamburg',
    lat: 53.5511,
    lng: 9.9937,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Operativ',
  },
  {
    id: 'munich',
    city: 'München',
    state: 'Bayern',
    country: 'Deutschland',
    address: 'München',
    lat: 48.1351,
    lng: 11.5820,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Operativ',
  },
  {
    id: 'cologne',
    city: 'Köln',
    state: 'Nordrhein-Westfalen',
    country: 'Deutschland',
    address: 'Köln',
    lat: 50.9365,
    lng: 6.9589,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Operativ',
  },
  {
    id: 'frankfurt',
    city: 'Frankfurt am Main',
    state: 'Hessen',
    country: 'Deutschland',
    address: 'Frankfurt am Main',
    lat: 50.1109,
    lng: 8.6821,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Operativ',
  },
  {
    id: 'leipzig',
    city: 'Leipzig',
    state: 'Sachsen',
    country: 'Deutschland',
    address: 'Leipzig',
    lat: 51.3397,
    lng: 12.3731,
    active: true,
    recruiting: false,  // erst nach Freigabe aktivieren
    roles: [],  // gesuchte Positionen erst nach Freigabe eintragen
    category: 'Operativ',
  },
]

// Job Categories
export const jobCategories = [
  { id: 'driver', label: 'Fahrer / Kurier', icon: 'Truck' },
  { id: 'dispatch', label: 'Disponent', icon: 'Map' },
  { id: 'team-lead', label: 'Teamleiter', icon: 'Users' },
  { id: 'site-lead', label: 'Standortleiter', icon: 'Building2' },
  { id: 'quality', label: 'Qualität & Reporting', icon: 'BarChart3' },
  { id: 'other', label: 'Weitere Positionen', icon: 'Briefcase' },
]

// ============================================================
// Jobs – CMS-ready data model with publication workflow
// ============================================================
//
// STATUS-WORKFLOW:
//   draft  → Rollenvorlage / in Vorbereitung, NIE öffentlich sichtbar
//   active → veröffentlicht, aber NUR wenn zusätzlich confirmed: true
//   paused → vorübergehend offline (bleibt im System)
//   closed → geschlossen (kein JobPosting-Schema, nicht öffentlich)
//
// Öffentlich erscheint eine Stelle ausschließlich, wenn
// status === 'active' UND confirmed === true (siehe publishedJobs).
//
// FREIGABEREGEL: salary, location, schedule, clientName und benefits
// bleiben null, bis die Werte von der Geschäftsführung freigegeben
// wurden. Die Felder existieren im Modell und werden automatisch
// angezeigt, sobald sie gefüllt sind.

export type JobStatus = 'draft' | 'active' | 'paused' | 'closed'

export interface Job {
  id: string
  title: string
  category: string
  status: JobStatus
  /** Öffentliche Sichtbarkeit erfordert status 'active' UND confirmed true */
  confirmed: boolean
  /** Kennzeichnung für unbestätigte Rollen (nur intern/Admin) */
  internalLabel?: string
  description: string
  responsibilities: string[]
  requirements: string[]
  /** Optionaler Hinweis, z. B. zu Erfahrungsanforderungen */
  experienceNote?: string
  // --- Felder, die erst nach Freigabe gefüllt werden ---
  location: string | null      // Standort-ID aus `locations`
  type: string | null          // z. B. 'Festanstellung'
  schedule: string | null      // z. B. 'Vollzeit'
  startDate: string | null
  salary: string | null
  clientName: string | null
  benefits: string[] | null
  drivingLicense: boolean
  published: string | null     // Veröffentlichungsdatum (bei Aktivierung setzen)
  expiryDate: string | null    // optionales Ablaufdatum für JobPosting-Schema
}

export const jobs: Job[] = [
  {
    id: 'rolle-fahrer-kurier',
    title: 'Fahrer / Kurier (m/w/d)',
    category: 'driver',
    status: 'draft',
    confirmed: false,
    internalLabel: 'Beispielposition – derzeit nicht veröffentlicht',
    description:
      'Als Fahrer / Kurier bist du das Gesicht von Jarbou auf der Straße. Du stellst Sendungen zuverlässig zu, holst sie ab und sorgst dafür, dass jede Tour sauber dokumentiert ist.',
    responsibilities: [
      'Zustellung und Abholung von Paketsendungen',
      'Scannen der Sendungen und vollständige Dokumentation',
      'Fahrzeug- und Tourencheck vor Fahrtantritt',
      'Einhaltung der Zustellzeitfenster',
      'Bearbeitung von Retouren',
      'Rückmeldung an die Disposition',
    ],
    requirements: [
      'Gültiger Führerschein',
      'Arbeitserlaubnis in Deutschland',
      'Zuverlässigkeit und Pünktlichkeit',
      'Sichere Fahrweise',
      'Bereitschaft zur Schichtarbeit',
      'Grundlegende Deutschkenntnisse für die Kommunikation',
    ],
    experienceNote:
      'Erfahrung in der Paketzustellung ist willkommen, aber nicht immer erforderlich.',
    location: null,
    type: null,
    schedule: null,
    startDate: null,
    salary: null,
    clientName: null,
    benefits: null,
    drivingLicense: true,
    published: null,
    expiryDate: null,
  },
  {
    id: 'rolle-disponent-logistik',
    title: 'Disponent Logistik (m/w/d)',
    category: 'dispatch',
    status: 'draft',
    confirmed: false,
    internalLabel: 'Beispielposition – derzeit nicht veröffentlicht',
    description:
      'Als Disponent steuerst du unsere Touren und hältst den operativen Betrieb am Laufen. Du planst Routen, koordinierst Fahrerteams und löst Probleme, bevor sie zu Verzögerungen werden.',
    responsibilities: [
      'Tourenplanung und Routenoptimierung',
      'Koordination der Fahrerinnen und Fahrer',
      'Kontrolle der Scanning-Qualität',
      'Operative Problemlösung im Tagesgeschäft',
      'Tägliches Reporting',
      'Kommunikation mit dem Standortteam',
    ],
    requirements: [
      'Erfahrung in Logistik oder Disposition',
      'Gute Deutschkenntnisse',
      'Sicherer Umgang mit dem Computer',
      'Organisationsfähigkeit',
      'Belastbarkeit',
      'Bereitschaft zu operativen Schichten',
    ],
    location: null,
    type: null,
    schedule: null,
    startDate: null,
    salary: null,
    clientName: null,
    benefits: null,
    drivingLicense: false,
    published: null,
    expiryDate: null,
  },
  {
    id: 'rolle-teamleiter-standortleiter',
    title: 'Teamleiter / Standortleiter Logistik (m/w/d)',
    category: 'team-lead',
    status: 'draft',
    confirmed: false,
    internalLabel: 'Beispielposition – derzeit nicht veröffentlicht',
    description:
      'Als Team- oder Standortleiter trägst du Verantwortung für den täglichen Betrieb, dein Fahrerteam und die Qualität am Standort. Du organisierst, entscheidest und packst selbst mit an.',
    responsibilities: [
      'Organisation des täglichen operativen Betriebs',
      'Verantwortung für die Fahrerinnen und Fahrer',
      'Unterstützung im Recruiting',
      'Qualitätskontrolle',
      'Problemlösung im Tagesgeschäft',
      'KPI-Monitoring',
      'Meetings und Abstimmung mit operativen Partnern',
    ],
    requirements: [
      'Führungserfahrung',
      'Logistik-Know-how',
      'Sichere Kommunikation auf Deutsch',
      'Zuverlässigkeit',
      'Organisationsstärke',
      'Qualitätsfokus',
      'Hands-on-Mentalität',
    ],
    location: null,
    type: null,
    schedule: null,
    startDate: null,
    salary: null,
    clientName: null,
    benefits: null,
    drivingLicense: false,
    published: null,
    expiryDate: null,
  },
  {
    id: 'rolle-qualitaet-reporting',
    title: 'Mitarbeiter Qualität & Reporting (m/w/d)',
    category: 'quality',
    status: 'draft',
    confirmed: false,
    internalLabel: 'Beispielposition – derzeit nicht veröffentlicht',
    description:
      'In Qualität & Reporting machst du Leistung sichtbar. Du überwachst Abhol- und Zustellqualität, prüfst Scans und Zeitfenster und lieferst die Berichte, mit denen wir täglich besser werden.',
    responsibilities: [
      'Monitoring der Abhol- und Zustellqualität',
      'Prüfung von Scans und Zeitfenstern',
      'Erstellung täglicher Reports',
      'Analyse von Touren',
      'Mitarbeit an der Verbesserung der operativen Leistung',
    ],
    requirements: [
      'Hohe Detailgenauigkeit',
      'Sicherer Umgang mit Daten und Tabellen',
      'Deutschkenntnisse für die Kommunikation',
      'Zuverlässigkeit',
      'Analytisches Denken',
    ],
    location: null,
    type: null,
    schedule: null,
    startDate: null,
    salary: null,
    clientName: null,
    benefits: null,
    drivingLicense: false,
    published: null,
    expiryDate: null,
  },
]

/** Öffentlich sichtbare Stellen: nur aktiv UND bestätigt. */
export const publishedJobs: Job[] = jobs.filter(
  j => j.status === 'active' && j.confirmed
)

// FAQs
export const faqs = [
  {
    question: 'Welche Positionen sind bei Jarbou verfügbar?',
    answer: 'Wir suchen regelmäßig Fahrer, Disponenten, Team- und Standortleiter sowie Qualitätsfachkräfte. Alle offenen Stellen finden Sie unter "Offene Stellen".',
  },
  {
    question: 'An welchen Standorten kann ich arbeiten?',
    answer: 'Jarbou ist mit Standorten in 7 deutschen Bundesländern präsent. Die meisten Positionen sind an unserem Hauptstandort Erfurt oder in den großen Logistikzentren verfügbar.',
  },
  {
    question: 'Brauche ich Erfahrung?',
    answer: 'Für Fahrerpositionen ist Liefererfahrung vorteilhaft, aber nicht immer erforderlich. Wir bieten umfangreiche Einarbeitung für engagierte Kandidaten.',
  },
  {
    question: 'Benötige ich einen Führerschein?',
    answer: 'Für Fahrerpositionen ist ein gültiger Führerschein der Klasse B oder C erforderlich. Für Büro- und Managementpositionen nicht zwingend nötig.',
  },
  {
    question: 'Wie lange dauert der Bewerbungsprozess?',
    answer: 'Unser Prozess ist effizient: Oft erhalten Sie innerhalb weniger Tage eine Rückmeldung. Die gesamte Einstellung kann in 1-2 Wochen abgeschlossen sein.',
  },
  {
    question: 'Gibt es eine strukturierte Einarbeitung?',
    answer: 'Ja, alle Positionen durchlaufen eine strukturierte Einarbeitung mit persönlicher Unterstützung durch erfahrene Kollegen.',
  },
  {
    question: 'Kann ich mich ohne Lebenslauf bewerben?',
    answer: 'Bei einigen Fahrerpositionen können Sie sich auch ohne Lebenslauf bewerben. Kurze Informationen zu Erfahrung und Verfügbarkeit reichen oft aus.',
  },
  {
    question: 'Kann ich mich initiativ bewerben?',
    answer: 'Selbstverständlich! Nutzen Sie unsere Initiativbewerbung und zeigen Sie uns, wo Sie Jarbou verstärken möchten.',
  },
]

// Company Values
export const companyValues = [
  {
    id: 'quality',
    title: 'Qualität zuerst',
    description: 'Wir machen Qualität zum Standard, nicht zur Ausnahme. Jede Lieferung zählt.',
  },
  {
    id: 'reliability',
    title: 'Verlässlichkeit',
    description: 'Unsere Kunden und Teams können sich auf uns verlassen – jeden Tag.',
  },
  {
    id: 'team',
    title: 'Starkes Team',
    description: 'Logistik ist Teamarbeit. Wir investieren in unsere Leute.',
  },
  {
    id: 'growth',
    title: 'Nachhaltig wachsen',
    description: 'Wir wachsen bewusst und verantwortungsvoll. Mit Maß statt Hektik.',
  },
  {
    id: 'data',
    title: 'Datenbasiert handeln',
    description: 'Transparente Daten treiben bessere Entscheidungen. Wir messen, was zählt.',
  },
]

// Company Timeline
export const companyTimeline = [
  {
    year: 2020,
    title: 'Gründung',
    description: 'Jarbou Logistik gegründet in Erfurt. Start mit 20-köpfigem Team und großer Vision.',
  },
  {
    year: 2021,
    title: 'Prozessaufbau',
    description: 'Aufbau robuster Prozesse und operativer Grundlagen. Fokus auf Qualität.',
  },
  {
    year: 2022,
    title: 'Wachstum',
    description: 'Rasantes Wachstum. Neue Standorte und Logistikpartner. Team und Flotte expandieren.',
  },
  {
    year: 2023,
    title: 'Konsolidierung',
    description: 'Stabilisierung der Abläufe. Fokus auf operative Exzellenz.',
  },
  {
    year: 2024,
    title: 'Expansion',
    description: 'Weitere Expansion. Neue Standorte in Ballungsräumen.',
  },
  {
    year: 2025,
    title: 'Digitalisierung',
    description: 'Investitionen in digitale Infrastruktur und Datenanalyse.',
  },
  {
    year: 2026,
    title: 'Transformation',
    description: 'Weiterführung der Digitalisierung. AI-gestützte Analyse und Optimierung. Stärkere Kundenorientierung.',
  },
]

// Hero media positioning (see README: "Hero ersetzen").
// CSS object-position values, separately for mobile and desktop.
// Examples: 'center center', 'center top', '30% center', 'left bottom'
export const heroMediaConfig = {
  mobilePosition: 'center center',
  desktopPosition: 'center center',
}

// Contact Information
export const contactInfo = {
  company: 'Jarbou Logistik GmbH',
  address: 'Erfurter Landstraße 50a',
  city: '99095 Erfurt',
  country: 'Deutschland',
  phone: '+49 170 7272725',
  email: 'kontakt@jarbou-logistik.com',
  careerEmail: 'karriere@jarbou-logistik.com',
  website: 'www.jarbou-logistik.com',
}
