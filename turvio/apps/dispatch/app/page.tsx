import { formatMinuteOfDay } from "@turvio/shared";
import { Badge, Kpi, Progress } from "@turvio/web-ui";
import { DispatchShell } from "../components/DispatchShell";
import { getTenantData, overviewKpis, summarizeTours } from "../lib/data";

const STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" }> = {
  planned: { label: "Geplant", tone: "neutral" },
  in_progress: { label: "Unterwegs", tone: "primary" },
  paused: { label: "Pausiert", tone: "warning" },
  completed: { label: "Abgeschlossen", tone: "success" },
};

// Tenant data is per request (and "today" must not be frozen at build time).
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const data = getTenantData();
  const tours = summarizeTours(data);
  const kpi = overviewKpis(tours);
  const date = data.tours[0]?.date ?? "";

  return (
    <DispatchShell current="/">
      <div className="page-head">
        <div>
          <h1>Touren heute</h1>
          <div className="muted">{date}</div>
        </div>
      </div>

      <div className="grid">
        <Kpi label="Touren" value={kpi.tours} hint={kpi.unassignedTours ? `${kpi.unassignedTours} ohne Fahrer` : "alle zugewiesen"} />
        <Kpi label="Stopps" value={kpi.stops} hint={`${kpi.done} erledigt`} />
        <Kpi label="Pakete" value={kpi.parcels} />
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tour</th>
              <th>Status</th>
              <th>Fahrer</th>
              <th>Fahrzeug</th>
              <th>Start</th>
              <th>Stopps</th>
              <th>Fortschritt</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((s) => (
              <tr key={s.tour.id}>
                <td>
                  <a href={`/tours/${s.tour.id}`}>{s.tour.name}</a>
                  <div className="muted">{s.depotName}</div>
                </td>
                <td>
                  <Badge tone={STATUS[s.tour.status]!.tone}>{STATUS[s.tour.status]!.label}</Badge>
                </td>
                <td>{s.driverName ?? <Badge tone="warning">nicht zugewiesen</Badge>}</td>
                <td>{s.vehicleLabel ?? "–"}</td>
                <td>{formatMinuteOfDay(s.tour.plannedStartMinute)}</td>
                <td>
                  {s.progress.total}
                  {s.priorityStops > 0 && <div className="muted">{s.priorityStops} Priorität</div>}
                  {s.timeWindowStops > 0 && <div className="muted">{s.timeWindowStops} Zeitfenster</div>}
                </td>
                <td style={{ minWidth: 140 }}>
                  <Progress value={s.progress.total ? s.progress.done / s.progress.total : 0} />
                  <div className="muted">
                    {s.progress.done}/{s.progress.total}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DispatchShell>
  );
}
