"use client";

import {
  OptimizeResponse,
  formatAddress,
  formatMinuteOfDay,
  orderStopsLocally,
  resequence,
  type Depot,
  type Driver,
  type Stop,
  type Tour,
} from "@turvio/shared";
import { Badge } from "@turvio/web-ui";
import { useState } from "react";
import { TourMap } from "./TourMap";

type Result = { engine: "server" | "local"; note: string };

export function TourWorkspace({ tour, depot, driver, initialStops }: { tour: Tour; depot: Depot; driver: Driver | null; initialStops: Stop[] }) {
  const [stops, setStops] = useState(initialStops);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function optimize() {
    setBusy(true);
    const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    const pending = stops.filter((s) => s.status === "pending" && s.location);
    try {
      if (api) {
        const res = await fetch(`${api}/v1/orgs/${encodeURIComponent(tour.organizationId)}/optimize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicles: [{ id: tour.id, start: depot.location, end: depot.location, shiftStart: tour.plannedStartMinute, maxShiftMinutes: driver?.maxShiftMinutes ?? 480 }],
            stops: pending.map((s) => ({ id: s.id, location: s.location, serviceSeconds: s.serviceSeconds, timeWindow: s.timeWindow, priority: s.priority, demand: Math.max(1, s.parcels.length) })),
            timeLimitSeconds: 5,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = OptimizeResponse.parse(await res.json());
        const order = new Map((data.routes[0]?.visits ?? []).map((v, i) => [v.stopId, i]));
        const routed = stops.filter((s) => order.has(s.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
        const rest = stops.filter((s) => !order.has(s.id));
        setStops(resequence([...stops.filter((s) => s.status !== "pending"), ...routed, ...rest.filter((s) => s.status === "pending")]));
        setResult({
          engine: "server",
          note: `OR-Tools (${data.matrixSource === "osrm" ? "Straßennetz" : "Luftlinien-Schätzung"}); ${data.unassignedStopIds.length} nicht einplanbar.`,
        });
      } else {
        const local = orderStopsLocally(stops, depot.location, depot.location);
        setStops(local.stops);
        setResult({ engine: "local", note: "Heuristik im Browser (ohne Zeitfenster) – API nicht konfiguriert." });
      }
    } catch (e) {
      setResult({ engine: "local", note: `Optimierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <TourMap depot={depot} stops={stops} />
      </div>
      <div className="page-head">
        <div className="muted">{result ? `${result.note} Vorschau – nicht gespeichert.` : "Reihenfolge wie geplant."}</div>
        <button className="btn" onClick={optimize} disabled={busy || tour.status === "completed"}>
          {busy ? "Optimiere…" : "Route optimieren"}
        </button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Empfänger</th>
              <th>Adresse</th>
              <th>Art</th>
              <th>Zeitfenster</th>
              <th>Pakete</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>
                  {s.recipientName ?? "–"} {s.priority && <Badge tone="warning">Priorität</Badge>}
                </td>
                <td>{formatAddress(s)}</td>
                <td>{s.type === "pickup" ? <Badge tone="primary">Abholung</Badge> : "Zustellung"}</td>
                <td>{s.timeWindow ? `${formatMinuteOfDay(s.timeWindow.start)}–${formatMinuteOfDay(s.timeWindow.end)}` : "–"}</td>
                <td>{s.parcels.map((p) => p.trackingNumber).join(", ") || "–"}</td>
                <td>{s.status === "pending" ? <Badge>Offen</Badge> : <Badge tone="success">{s.status}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
