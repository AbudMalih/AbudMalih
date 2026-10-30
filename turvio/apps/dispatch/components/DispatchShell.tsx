import { Shell } from "@turvio/web-ui";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Übersicht" },
  { href: "/drivers", label: "Fahrer" },
  { href: "/vehicles", label: "Fahrzeuge" },
  { href: "/depots", label: "Depots" },
];

export function DispatchShell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <Shell product="Dispatch" nav={NAV} current={current} footer={<>JARBOU Logistik GmbH<br />Mandant (synthetisch)</>}>
      <div className="banner" role="note">
        Entwicklungsmodus: synthetische Daten, Anmeldung noch nicht angebunden. Änderungen werden nicht gespeichert.
      </div>
      {children}
    </Shell>
  );
}
