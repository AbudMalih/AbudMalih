import GlobeExperiment from "@/components/lab/GlobeExperiment";
import LabBar from "@/components/lab/LabBar";
import LabNotes from "@/components/lab/LabNotes";

export const metadata = { title: "Lab 01 · Globus" };

export default function Page() {
  return (
    <main>
      <GlobeExperiment />
      <LabNotes
        title="01 · Immersiver Handelsglobus"
        note={{
          tech: ["Three.js (eigener GLSL-Shader)", "GSAP Timeline", "GSAP InertiaPlugin", "GSAP SplitText", "HTML-Labels per Projektion"],
          distinct:
            "Kein Template-Globus: eine Seekarten-Ästhetik aus echten Daten. Tiefenlinien entlang der Küsten, Relief aus dem Höhenmodell, gravierte Schraffur im Schatten, eine haarfeine Küstenlinie. Die drei Routen zeichnen sich selbst; ein Klick fliegt die Kamera zur Route.",
          business:
            "Erklärt in Sekunden, was Luna Trading tut: Ware aus Asien über See, Schiene oder Luft nach Deutschland, mit den Richtwerten aus den bestehenden Inhalten. Köln ist als Ziel markiert.",
          mobile:
            "Globus oben, Text und Routen darunter, Routen als wischbare Leiste. Wischen dreht den Globus, vertikales Scrollen bleibt frei. Routen sind echte Buttons (Tastatur, aria-pressed). Bei reduzierter Bewegung: kein Intro, keine Eigenrotation, alle Routen sofort sichtbar.",
          perf:
            "Ein WebGL-Kontext, ein Shader, keine Partikel. Rendert nur, solange der Globus sichtbar und der Tab aktiv ist. Pixeldichte begrenzt (1,5 mobil / 2 Desktop), kleinere Textur und weniger Geometrie auf Mobilgeräten.",
        }}
      />
      <LabBar current="/lab/globe" />
    </main>
  );
}
