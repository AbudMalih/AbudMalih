import StoryExperiment from "@/components/lab/StoryExperiment";
import LabBar from "@/components/lab/LabBar";
import LabNotes from "@/components/lab/LabNotes";

export const metadata = { title: "Lab 03 · Scroll-Story" };

export default function Page() {
  return (
    <main>
      <StoryExperiment />
      <LabNotes
        title="03 · Cinematische Scroll-Story"
        note={{
          tech: ["GSAP Timeline + ScrollTrigger (scrub, natives Scrollen)", "GSAP DrawSVGPlugin", "GSAP MotionPathPlugin", "Isometrisches SVG, aus Code generiert", "position: sticky"],
          distinct:
            "Keine Abfolge von Abschnitten, sondern eine einzige Szene mit einer Hauptfigur: Ein Karton mit dem Luna-Plus wird geprüft, in einen Container geladen, reist über die Seeroute nach Hamburg und Köln, landet im Lagerregal und verteilt sich auf die Vertriebskanäle. Vor- und rückwärts, ohne Schnitt.",
          business:
            "Erklärt das Geschäftsmodell (Beschaffung → Import → Transport → Distribution → E-Commerce) ohne Fachbegriffe in einem Bild. Der Text links nennt pro Station die bestehenden Leistungen und Richtwerte.",
          mobile:
            "Szene oben, Text unten, Stationen als wischbare Leiste. Jede Station ist ein Button und springt per natürlichem Scrollen dorthin. Alle Inhalte sind echter Text (Live-Region für Screenreader); die Grafik ist dekorativ. Reduzierte Bewegung: keine Übergänge, die Szene zeigt je Station den Endzustand.",
          perf:
            "Reines SVG (kein WebGL), animiert über transform, opacity und stroke. Ein ScrollTrigger für die ganze Szene; nichts läuft, wenn nicht gescrollt wird.",
        }}
      />
      <LabBar current="/lab/story" />
    </main>
  );
}
