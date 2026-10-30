import { DispatchShell } from "../../components/DispatchShell";
import { getTenantData } from "../../lib/data";

// Tenant data is per request (and "today" must not be frozen at build time).
export const dynamic = "force-dynamic";

export default function VehiclesPage() {
  const data = getTenantData();
  return (
    <DispatchShell current="/vehicles">
      <h1>Fahrzeuge</h1>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Bezeichnung</th><th>Kennzeichen</th><th>Depot</th><th>Kapazität (Pakete)</th></tr>
          </thead>
          <tbody>
            {data.vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.label}</td>
                <td>{v.licensePlate}</td>
                <td>{data.depots.find((x) => x.id === v.depotId)?.name ?? "–"}</td>
                <td>{v.capacityParcels ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DispatchShell>
  );
}
