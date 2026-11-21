import NavExperiment from "@/components/lab/NavExperiment";
import LabBar from "@/components/lab/LabBar";
import LabNotes from "@/components/lab/LabNotes";

export const metadata = { title: "Lab 04 · Navigation" };

export default function Page() {
  return (
    <>
      <NavExperiment />
      <LabNotes
        title="04 · Premium-Navigation"
        note={{
          tech: ["GSAP (Indikator, Mega-Menü, Vollbild-Menü)", "React Bits Magnet (Haupt-Button)", "CSS backdrop-filter", "ARIA: aria-expanded, aria-current, aria-modal, Fokusfalle"],
          distinct:
            "Ein heller Indikator gleitet unter dem Zeiger von Punkt zu Punkt und kehrt zur aktuellen Seite zurück. „Leistungen“ öffnet ein Mega-Menü, das beim Überfahren jeder Leistung Bild und Beschreibung wechselt. Die Kopfzeile tritt beim Lesen zurück und ist beim Hochscrollen sofort da. Das Vollbild-Menü kommt in zwei Farbebenen (Luna-Rot, Anthrazit), die Links steigen aus einer Maske.",
          business:
            "Alle sechs Leistungen sind mit einem Blick erreichbar, mit ihrer Kurzbeschreibung aus den bestehenden Inhalten. „Angebot anfragen“ ist auf jeder Ebene sichtbar.",
          mobile:
            "Unter 1100 px: ein großer „Menü“-Button, Vollbild-Menü mit großen Zielen, Sprache und Anfrage im Fuß. Escape schließt, der Fokus bleibt im Menü und kehrt danach zum Button zurück; die Seite scrollt nicht darunter. Reduzierte Bewegung: alle Übergänge sofort.",
          perf:
            "Nur transform, opacity und clip-path; keine Abhängigkeiten außer GSAP. Der Scroll-Listener ist passiv und schreibt nur zwei Attribute.",
        }}
      />
      <LabBar current="/lab/nav" />
    </>
  );
}
