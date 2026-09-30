import { PendingPage } from "@/components/layout/PendingPage";

export default function NotFound() {
  return <PendingPage eyebrow="Fehler 404" title="Diese Seite gibt es nicht." text="Die angeforderte Adresse wurde nicht gefunden. Prüfen Sie die URL oder kehren Sie zur Startseite zurück." legal={false} />;
}
