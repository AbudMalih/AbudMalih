/** Site-wide configuration. */
export const site = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.jarbou-logistik.com").replace(/\/$/, ""),
  locale: "de_DE",
  lang: "de",
  title: "JARBOU Logistik GmbH – Logistik, die messbar funktioniert.",
  description:
    "Transport, Zustellung und Last Mile seit 2019. Über 160 Mitarbeitende, mehr als 180 Transporter und 25 LKW – im Einsatz in mehreren Regionen Deutschlands.",
} as const;
