export type NavItem = { label: string; href: string };

export const mainNav: NavItem[] = [
  { label: "Start", href: "/" },
  { label: "Unternehmen", href: "/unternehmen" },
  { label: "Leistungen", href: "/leistungen" },
  { label: "Standorte", href: "/standorte" },
  { label: "Karriere", href: "/karriere" },
  { label: "Kontakt", href: "/kontakt" },
];

export const ctas = {
  business: { label: "Logistik anfragen", href: "/business" },
  apply: { label: "Jetzt bewerben", href: "/karriere" },
} as const;

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Unternehmen",
    items: [
      { label: "Über uns", href: "/unternehmen" },
      { label: "Leistungen", href: "/leistungen" },
      { label: "Standorte", href: "/standorte" },
      { label: "Qualität", href: "/#qualitaet" },
    ],
  },
  {
    title: "Karriere",
    items: [
      { label: "Jobs", href: "/karriere" },
      { label: "Bei JARBOU", href: "/karriere" },
      { label: "Bewerbungsprozess", href: "/karriere" },
      { label: "Initiativbewerbung", href: "/karriere" },
    ],
  },
  {
    title: "Kontakt",
    items: [
      { label: "Geschäftsanfrage", href: "/business" },
      { label: "Allgemeiner Kontakt", href: "/kontakt" },
    ],
  },
];

export const legalNav: NavItem[] = [
  { label: "Impressum", href: "/impressum" },
  { label: "Datenschutz", href: "/datenschutz" },
];
