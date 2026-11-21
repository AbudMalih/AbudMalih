import TypeExperiment from "@/components/lab/TypeExperiment";
import LabBar from "@/components/lab/LabBar";
import LabNotes from "@/components/lab/LabNotes";

export const metadata = { title: "Lab 02 · Typografie" };

export default function Page() {
  return (
    <main>
      <TypeExperiment />
      <LabNotes
        title="02 · Kinetische Typografie"
        note={{
          tech: ["GSAP SplitText (Masken, Zeichen/Wörter)", "GSAP ScrollTrigger (scrub)", "React Bits: VariableProximity, ScrollReveal, ScrambledText", "Variable Schrift Inter Tight (wght 100–900)", "CSS background-clip:text"],
          distinct:
            "Typografie als Bewegung, nicht als Einblendung: die Schlagzeile tritt beiseite und gibt den Satz frei; die Schriftstärke folgt dem Zeiger; ein Absatz wird beim Lesen scharf; Kontur füllt sich mit der Leseposition; das Wort EUROPA wird zum Fenster auf den Hafen und öffnet sich ins Vollbild.",
          business:
            "Die Kernaussagen (Handel ohne Grenzen, Von der Quelle bis zum Markt, Sechs Disziplinen) werden zu Momenten, die man sich merkt, ohne dass Text versteckt wird. Alles bleibt echtes, indexierbares HTML.",
          mobile:
            "Gleiche Momente, kürzere Scrollwege; Zeiger-Effekte laufen auf Touch als ruhige Welle. Arabisch wird nach Wörtern (nicht Buchstaben) animiert, damit die Schrift verbunden bleibt. Bei reduzierter Bewegung: alles sofort lesbar, keine Sticky-Szenen.",
          perf:
            "Nur transform, opacity und filter auf wenigen Elementen; keine Canvas, kein WebGL. Scroll-Szenen nutzen natives Scrollen mit position: sticky, kein Scroll-Jacking.",
        }}
      />
      <LabBar current="/lab/type" />
    </main>
  );
}
