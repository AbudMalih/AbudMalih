"use client";

import { formatClock, type Stop, type Tour } from "@turvio/shared";
import { Badge, Button, Sheet, Skeleton, type BadgeTone } from "@turvio/web-ui/ds";
import { ArchiveRestore, Map as MapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import { lifecycleApi, STATUS_LABEL, type TourEvent } from "../lib/lifecycle";
import { useDispatch } from "../lib/store";
import { STOP_STATUS } from "./StatusBadge";
import { TourActionsMenu } from "./TourActions";

export const LIFECYCLE_TONE: Record<Tour["status"], BadgeTone> = {
  planned: "neutral",
  in_progress: "brand",
  paused: "warning",
  completed: "success",
  cancelled: "danger",
};

/** Status + archive/publication markers of a tour, as used in lists and drawers. */
export function LifecycleBadges({ tour }: { tour: Tour }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={LIFECYCLE_TONE[tour.status]} dot>
        {STATUS_LABEL[tour.status]}
      </Badge>
      {tour.archivedAt && <Badge tone="outline">Archived</Badge>}
      {tour.closedRemotely && <Badge tone="outline">Closed by Dispatch</Badge>}
      {tour.status === "planned" && <Badge tone={tour.publishedAt ? "info" : "outline"}>{tour.publishedAt ? "Published" : "Not published"}</Badge>}
    </span>
  );
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–");

const EVENT_LABEL: Record<string, string> = {
  created: "Created",
  assigned: "Driver / vehicle assigned",
  optimized: "Optimized",
  published: "Published",
  unpublished: "Withdrawn",
  started: "Started",
  paused: "Paused",
  resumed: "Resumed",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
  restored: "Restored",
  rescheduled: "Moved",
  note: "Driver note",
  returned: "Returned to unassigned list",
};

/**
 * Any tour, any date, archived or not – loaded from the server (the day view only holds today's
 * active tours). Read-only record plus the actions its state allows.
 */
export function TourRecordSheet({ tourId, onOpenChange, onChanged }: { tourId: string | null; onOpenChange: (open: boolean) => void; onChanged?: () => void }) {
  const { session, scoped, openTour } = useDispatch();
  const router = useRouter();
  const api = lifecycleApi(session.organizationId);
  const [data, setData] = useState<{ tour: Tour; stops: Stop[]; events: TourEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!tourId) return;
    setError(null);
    try {
      const [t, events] = await Promise.all([api.get(tourId), api.events(tourId).catch(() => [] as TourEvent[])]);
      setData({ ...t, events });
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, session.organizationId]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const t = data?.tour;
  const depot = t ? scoped.depots.find((d) => d.id === t.depotId) : undefined;
  const driver = t?.driverId ? scoped.drivers.find((d) => d.id === t.driverId) : undefined;
  const open = (s: Stop) => s.status === "pending" || s.status === "in_progress";
  const inDayView = t && !t.archivedAt && t.status !== "cancelled";
  return (
    <Sheet open={!!tourId} onOpenChange={onOpenChange} title={t ? `Tour ${t.name}` : "Tour"} description={t ? `${depot?.name ?? ""} · ${t.date}` : undefined} className="max-w-lg">
      {error && <p className="text-[13px] text-danger-ink">{error}</p>}
      {!data && !error && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24" />
        </div>
      )}
      {t && data && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <LifecycleBadges tour={t} />
            <TourActionsMenu
              item={{ tour: t, depotName: depot?.name, driverName: driver?.displayName ?? null, stopCount: data.stops.length, openStops: data.stops.filter(open).length }}
              onChanged={() => {
                void load();
                onChanged?.();
              }}
              onDeleted={() => onOpenChange(false)}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Driver</dt>
              <dd className="font-semibold text-ink">{driver?.displayName ?? "–"}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Planned start</dt>
              <dd className="font-semibold text-ink tabular">{formatClock(t.plannedStartMinute)}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Started</dt>
              <dd className="tabular">{when(t.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t.status === "cancelled" ? "Cancelled" : "Finished"}</dt>
              <dd className="tabular">{when(t.closedAt ?? t.finishedAt)}</dd>
            </div>
            {t.closeReason && (
              <div className="col-span-2">
                <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Reason{t.closedRemotely ? " (closed by Dispatch)" : ""}</dt>
                <dd className="text-ink">{t.closeReason}</dd>
              </div>
            )}
            {t.archivedAt && (
              <div className="col-span-2">
                <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Archived</dt>
                <dd>{when(t.archivedAt)} · everything kept</dd>
              </div>
            )}
          </dl>
          {inDayView && (
            <Button
              variant="secondary"
              onClick={async () => {
                onOpenChange(false);
                await openTour(t.date, t.id);
                router.push("/map");
              }}
            >
              <MapIcon /> Open in the day view
            </Button>
          )}
          {t.archivedAt && (
            <p className="flex items-center gap-1.5 text-2xs text-muted">
              <ArchiveRestore className="size-3.5" /> Restore it to work with it in the day view again (its status stays {STATUS_LABEL[t.status].toLowerCase()}).
            </p>
          )}
          <section aria-label="Stops">
            <h3 className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">
              Stops ({data.stops.length})
            </h3>
            {data.stops.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-3 text-center text-[13px] text-muted">No stops on this tour.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line rounded-xl border border-line">
                {data.stops.map((s, i) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="me-1.5 text-muted tabular">{i + 1}.</span>
                      <span className="font-medium text-ink">{s.recipientName ?? s.address.street}</span>
                      <span className="block truncate text-2xs text-muted">
                        {s.address.street} {s.address.houseNumber ?? ""}, {s.address.postalCode} {s.address.city}
                      </span>
                      {s.cancelReason && <span className="block text-2xs text-danger-ink">Cancelled: {s.cancelReason}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <Badge tone={STOP_STATUS[s.status].tone}>{STOP_STATUS[s.status].label}</Badge>
                      {s.completedAt && <span className="text-2xs text-muted tabular">{when(s.completedAt)}</span>}
                      {(s.proofs?.length ?? 0) > 0 && <span className="text-2xs text-muted">{s.proofs!.length} proof(s)</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section aria-label="History">
            <h3 className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">History</h3>
            <ol className="flex flex-col gap-1 text-[12.5px]">
              {data.events
                .filter((e) => e.source === "tour")
                .map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink-2">
                      {EVENT_LABEL[e.kind] ?? e.kind}
                      {typeof e.detail?.reason === "string" ? ` – ${e.detail.reason}` : ""}
                      {e.kind === "rescheduled" && typeof e.detail?.toDate === "string" ? ` to ${e.detail.toDate}` : ""}
                    </span>
                    <span className="shrink-0 text-muted tabular">{when(e.at)}</span>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      )}
    </Sheet>
  );
}
