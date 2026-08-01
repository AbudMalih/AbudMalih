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
    recruiting: true,
    roles: ['Fahrer', 'Disponent', 'Teamleiter'],
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
    recruiting: true,
    roles: ['Fahrer', 'Disponent'],
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
    recruiting: true,
    roles: ['Fahrer'],
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
    recruiting: false,
    roles: ['Fahrer'],
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
    recruiting: true,
    roles: ['Fahrer', 'Teamleiter'],
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
    recruiting: true,
    roles: ['Fahrer', 'Disponent'],
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
    recruiting: false,
    roles: ['Fahrer'],
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

// Sample Jobs - These are demo jobs with clear labels
export const jobs = [
  {
    id: 'job-driver-erfurt-001',
    title: 'Fahrer / Kurier (m/w/d) - Erfurt',
    category: 'driver',
    location: 'erfurt',
    type: 'Festanstellung',
    schedule: 'Vollzeit',
    startDate: '2026-09-01',
    published: '2026-08-01',
    description: 'Wir suchen zuverlässige Fahrer und Kuriere für unser Erfurter Netzwerk. Sie arbeiten mit modernen Fahrzeugen, fahren festgelegte Routen und liefern täglich Qualität.',
    responsibilities: [
      'Regelmäßige Paketzustellungen und -abholungen',
      'Vollständige Sendungsdokumentation und Scanning',
      'Einhaltung von Zeitfenstern und Qualitätsstandards',
      'Tägliche Fahrzeuguberprüfung und Wartung',
      'Zusammenarbeit mit dem Dispatch-Team',
    ],
    requirements: [
      'Führerschein Klasse B oder C erforderlich',
      'Erfahrung in Kurier- oder Paketdiensten von Vorteil',
      'Zuverlässigkeit und Belastbarkeit',
      'Gute Deutschkenntnisse',
      'Bereitschaft zu Wochenendtouren',
    ],
    benefits: [
      'Unbefristete Anstellung',
      'Moderner Fuhrpark',
      'Strukturierte Einarbeitung',
      'Persönliche Ansprechpartner',
      'Entwicklungsmöglichkeiten',
    ],
    salary: null,
    drivingLicense: true,
    status: 'open',
  },
  {
    id: 'job-dispatch-erfurt-001',
    title: 'Disponent (m/w/d) - Erfurt',
    category: 'dispatch',
    location: 'erfurt',
    type: 'Festanstellung',
    schedule: 'Vollzeit',
    startDate: '2026-09-01',
    published: '2026-08-01',
    description: 'Als Disponent koordinieren Sie unsere Touren und Flotte. Sie planen Routen, optimieren Abläufe und arbeiten eng mit unseren Fahrerteams zusammen.',
    responsibilities: [
      'Tägliche Tourenplanung und -optimierung',
      'Koordination mit Fahrerteams',
      'Monitoring von Lieferterminen und Zeitfenstern',
      'Qualitätskontrolle und Reporting',
      'Enge Zusammenarbeit mit Kundensupport',
    ],
    requirements: [
      'Erfahrung in Tourenplanung oder Logistik',
      'Sichere Beherrschung von Dispositionssoftware',
      'Organisationstalent und Belastbarkeit',
      'Gute Deutschkenntnisse',
      'Problemlösungsfähigkeit',
    ],
    benefits: [
      'Unbefristete Anstellung',
      'Modernes Büro-Setup',
      'Strukturierte Einarbeitung',
      'Entwicklungsperspektiven zur Standortleitung',
      'Flexible Arbeitszeiten wo möglich',
    ],
    salary: null,
    drivingLicense: false,
    status: 'open',
  },
  {
    id: 'job-teamlead-berlin-001',
    title: 'Teamleiter (m/w/d) - Berlin',
    category: 'team-lead',
    location: 'berlin',
    type: 'Festanstellung',
    schedule: 'Vollzeit',
    startDate: '2026-10-01',
    published: '2026-08-01',
    description: 'Führen Sie ein Team von Fahrern und unterstützen Sie bei der täglichen Abwicklung. Sie sind Ansprechpartner für Fahrer, Kunden und das Management.',
    responsibilities: [
      'Führung und Entwicklung des Fahrerteams',
      'Qualitätskontrolle und Compliance',
      'Kundenbetreuung und Problemlösung',
      'Personalplanung und Reporting',
      'Einhaltung von Sicherheits- und Qualitätsstandards',
    ],
    requirements: [
      'Mehrjährige Erfahrung in Teamleitung oder Logistik',
      'Führungserfahrung erforderlich',
      'Sichere Deutschkenntnisse',
      'Bereitschaft zu flexiblen Arbeitszeiten',
      'Unternehmerisches Denken',
    ],
    benefits: [
      'Unbefristete Anstellung',
      'Attraktive Vergütung',
      'Strukturierte Einarbeitung',
      'Aufstiegsmöglichkeiten zur Standortleitung',
      'Moderne Ausstattung und Tools',
    ],
    salary: null,
    drivingLicense: false,
    status: 'open',
  },
]

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
