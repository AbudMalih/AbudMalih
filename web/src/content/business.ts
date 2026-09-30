import { services } from "./services";

/** /business – B2B page content. No customer references until approved. */
export const businessPage = {
  eyebrow: "Für Unternehmen",
  lines: ["Operative Logistik.", "Zuverlässig skaliert."],
  lead: "Wir stellen Teams, Fahrzeuge und operative Führung für Transport-, Express- und Last-Mile-Projekte – planbar, messbar und mit klaren Ansprechpartnern.",
  audiences: [
    { id: "netzwerke", title: "Logistiknetzwerke", text: "Die zusätzliche operative Kapazität in ihren Regionen benötigen." },
    { id: "logistiker", title: "Logistikunternehmen", text: "Die für Zustell- und Transportprojekte einen verlässlichen Partner suchen." },
    { id: "kapazitaet", title: "Unternehmen mit Zustellbedarf", text: "Die operative Zustellkapazität auslagern möchten." },
    { id: "lastmile", title: "Regionale Last-Mile-Projekte", text: "Für die ein Partner mit eigenen Teams und Fahrzeugen gebraucht wird." },
  ],
  capabilities: [
    { id: "teams", figure: "160+", label: "Mitarbeitende", text: "Eigene Teams aus Fahrern, Disposition und Führung." },
    { id: "vans", figure: "180+", label: "Transporter", text: "Für Zustellung und Abholung auf der letzten Meile." },
    { id: "trucks", figure: "25", label: "LKW", text: "Für Transporte mit größerem Volumen." },
  ],
  projectSteps: [
    { id: "anfrage", index: "01", title: "Anfrage", text: "Sie beschreiben Standort, Leistungsart, Volumen und gewünschten Start." },
    { id: "abstimmung", index: "02", title: "Abstimmung", text: "Wir klären Anforderungen, Abläufe und Zeitfenster im Gespräch." },
    { id: "konzept", index: "03", title: "Konzept", text: "Sie erhalten ein Konzept mit Personal-, Fahrzeug- und Tourenplanung." },
    { id: "start", index: "04", title: "Projektstart", text: "Teams werden eingearbeitet, Fahrzeuge bereitgestellt, Abläufe eingeführt." },
    { id: "betrieb", index: "05", title: "Laufender Betrieb", text: "Operative Führung vor Ort und Steuerung über Kennzahlen." },
  ],
};

export const serviceTypeOptions = services.map((s) => s.title);

export const vehicleNeedOptions = ["Transporter", "LKW", "Transporter und LKW", "Noch offen"] as const;
