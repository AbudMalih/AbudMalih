import { sortBySequence } from "@turvio/shared";
import { notFound } from "next/navigation";
import { DispatchShell } from "../../../components/DispatchShell";
import { TourWorkspace } from "../../../components/TourWorkspace";
import { getTenantData } from "../../../lib/data";

export default async function TourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getTenantData();
  const tour = data.tours.find((t) => t.id === id);
  const depot = data.depots.find((d) => d.id === tour?.depotId);
  if (!tour || !depot) notFound();
  const driver = data.drivers.find((d) => d.id === tour.driverId) ?? null;
  const stops = sortBySequence(data.stops.filter((s) => s.tourId === tour.id));

  return (
    <DispatchShell current="/">
      <div className="page-head">
        <div>
          <a href="/" className="muted">← Übersicht</a>
          <h1>{tour.name}</h1>
          <div className="muted">
            {depot.name} · {driver?.displayName ?? "kein Fahrer"} · {stops.length} Stopps
          </div>
        </div>
      </div>
      <TourWorkspace tour={tour} depot={depot} driver={driver} initialStops={stops} />
    </DispatchShell>
  );
}
