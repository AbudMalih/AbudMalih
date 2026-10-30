import { DispatchShell } from "../../components/DispatchShell";
import { getTenantData } from "../../lib/data";

// Tenant data is per request (and "today" must not be frozen at build time).
export const dynamic = "force-dynamic";

export default function DepotsPage() {
  const data = getTenantData();
  return (
    <DispatchShell current="/depots">
      <h1>Depots</h1>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Adresse</th><th>Koordinaten</th></tr>
          </thead>
          <tbody>
            {data.depots.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.address.street} {d.address.houseNumber}, {d.address.postalCode} {d.address.city}</td>
                <td>{d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DispatchShell>
  );
}
