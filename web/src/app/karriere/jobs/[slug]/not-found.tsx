import { StatusPage } from "@/components/layout/StatusPage";
import { ButtonLink } from "@/components/ui/Button";

export default function JobNotFound() {
  return (
    <StatusPage
      code="Stelle nicht verfügbar"
      title={["Diese Stelle ist", "nicht mehr offen."]}
      text="Die Stellenanzeige wurde besetzt oder ist abgelaufen. Schau dir die aktuellen Stellen an – oder bewirb dich initiativ."
    >
      <ButtonLink href="/karriere#jobs">Aktuelle Stellen</ButtonLink>
      <ButtonLink href="/karriere/initiativbewerbung" variant="outline">
        Initiativ bewerben
      </ButtonLink>
    </StatusPage>
  );
}
