import { Badge } from "@turvio/web-ui";
import { DispatchShell } from "../../components/DispatchShell";
import { getTenantData } from "../../lib/data";

// Tenant data is per request (and "today" must not be frozen at build time).
export const dynamic = "force-dynamic";

export default function DriversPage() {
  const data = getTenantData();
  return (
    <DispatchShell current="/drivers">
      <h1>Fahrer</h1>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Depot</th><th>Max. Schicht</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.drivers.map((d) => (
              <tr key={d.id}>
                <td>{d.displayName}</td>
                <td>{data.depots.find((x) => x.id === d.depotId)?.name ?? "–"}</td>
                <td>{(d.maxShiftMinutes / 60).toFixed(1)} h</td>
                <td>{d.active ? <Badge tone="success">aktiv</Badge> : <Badge>inaktiv</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DispatchShell>
  );
}
