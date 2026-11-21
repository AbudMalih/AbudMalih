import Link from "next/link";

export const metadata = { title: "Interactive Experience Lab" };

const EXP = [
  ["/lab/globe", "01", "Immersiver Handelsglobus", "Neuer Three.js-Globus im Vergleich zum bestehenden. Routen, Kamerafahrten, Drehen mit Schwung."],
  ["/lab/type", "02", "Kinetische Typografie", "Maskierte Zeilen, variable Schriftstärke unter dem Cursor, Text, der sich beim Scrollen schärft und füllt."],
  ["/lab/story", "03", "Scroll-Story: Eine Ware, eine Reise", "Eine Szene verwandelt sich: Beschaffung, Import, Transport, Distribution, E-Commerce."],
  ["/lab/nav", "04", "Premium-Navigation", "Gleitender Indikator, Mega-Menü mit Vorschau, Vollbild-Menü für Mobilgeräte."],
  ["/lab/components", "05", "Signatur-Komponenten", "Leistungsindex mit Bildspur, Spotlight- und Tilt-Karten, magnetische Buttons, Flip-Akkordeon."],
] as const;

export default function Lab() {
  return (
    <main style={{ minHeight: "100svh", padding: "clamp(32px, 7vw, 100px) var(--m)", display: "grid", alignContent: "center" }}>
      <p className="mono" style={{ color: "var(--red-on-dark)", margin: 0 }}>Luna Trading V2 · Interactive Experience Lab</p>
      <h1 style={{ margin: "16px 0 0", fontSize: "clamp(2.6rem, 7vw, 6.6rem)", lineHeight: .92, letterSpacing: "-.05em", fontWeight: 650, maxWidth: "14ch" }}>
        Fünf Experimente. <em style={{ fontFamily: "var(--serif)", fontWeight: 400, color: "var(--red)" }}>Zum Ausprobieren.</em>
      </h1>
      <p style={{ maxWidth: "40em", color: "#b9b9be", margin: "22px 0 0" }}>
        Isolierte Prototypen für die Auswahl der V2-Interaktionen. Echte Inhalte, echte Technik, keine Startseite. Jedes Experiment erklärt sich über „Über dieses Experiment“.
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: "48px 0 0", borderTop: "1px solid rgba(255,255,255,.12)" }}>
        {EXP.map(([href, n, t, d]) => (
          <li key={href} style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
            <Link href={href} className="labRow">
              <span className="mono" style={{ color: "var(--red-on-dark)" }}>{n}</span>
              <strong>{t}</strong>
              <span style={{ color: "#a6a7ac" }}>{d}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
