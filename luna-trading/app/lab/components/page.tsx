import ComponentsExperiment from "@/components/lab/ComponentsExperiment";
import LabBar from "@/components/lab/LabBar";
import LabNotes from "@/components/lab/LabNotes";

export const metadata = { title: "Lab 05 · Komponenten" };

export default function Page() {
  return (
    <main>
      <ComponentsExperiment />
      <LabNotes
        title="05 · Signatur-Komponenten"
        note={{
          tech: ["GSAP quickTo (Bildspur)", "GSAP Flip (Layout-Übergang)", "GSAP Draggable + InertiaPlugin", "React Bits: SpotlightCard, TiltedCard, Magnet"],
          distinct:
            "Kein Kartenraster: ein Leistungsindex, bei dem ein Bild dem Zeiger folgt und sich in die Bewegung neigt; Karten, die ein Licht unter dem Zeiger tragen; eine Bildkarte mit Tiefenebenen; Transportwege, die per Flip den Raum tauschen; Routen zum Ziehen mit Schwung; Buttons, die sich dem Zeiger zuneigen.",
          business:
            "Jede Komponente trägt bestehende Inhalte: Leistungen mit Kurzbeschreibung, Distribution, Marken, Transportwege mit Richtwerten, typische Handelsrouten und die Kontaktaufforderung.",
          mobile:
            "Auf Touch tippt man eine Leistung an und sieht ihr Bild darunter; Karten stapeln sich; Routen lassen sich wischen, Pfeil-Buttons funktionieren auch ohne Ziehen. Alle Elemente sind echte Links und Buttons (Tastatur, aria-selected, aria-expanded). Reduzierte Bewegung: keine Bildspur-Verzögerung, Flip ohne Animation.",
          perf:
            "Pointer-Effekte nur bei echtem Zeiger, alles über transform/opacity, keine dauerhaft laufenden Animationen.",
        }}
      />
      <LabBar current="/lab/components" />
    </main>
  );
}
