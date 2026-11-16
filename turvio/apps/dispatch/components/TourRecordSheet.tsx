"use client";

import { formatClock, type Stop, type Tour } from "@turvio/shared";
import { Badge, Button, Sheet, Skeleton, type BadgeTone } from "@turvio/web-ui/ds";
import { ArchiveRestore, Map as MapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import type { MessageKey } from "../lib/i18n";
import { useI18n, useT } from "../lib/i18n/client";
import { lifecycleApi, statusLabel, type TourEvent } from "../lib/lifecycle";
import { useDispatch } from "../lib/store";
import { STOP_STATUS, stopStatusLabel } from "./StatusBadge";
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
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={LIFECYCLE_TONE[tour.status]} dot>
        {statusLabel(tour.status, t)}
      </Badge>
      {tour.archivedAt && <Badge tone="outline">{t("tours.rec.archived")}</Badge>}
      {tour.closedRemotely && <Badge tone="outline">{t("tours.rec.closedByDispatch")}</Badge>}
      {tour.status === "planned" && <Badge tone={tour.publishedAt ? "info" : "outline"}>{tour.publishedAt ? t("tours.rec.published") : t("common.notPublished")}</Badge>}
    </span>
  );
}

/** Tour event kinds with a label (`tours.event.<kind>`); other kinds are shown as sent. */
const EVENT_KINDS = new Set(["created", "assigned", "optimized", "published", "unpublished", "started", "paused", "resumed", "completed", "cancelled", "archived", "restored", "rescheduled", "note", "returned"]);

/**
 * Any tour, any date, archived or not – loaded from the server (the day view only holds today's
 * active tours). Read-only record plus the actions its state allows.
 */
export function TourRecordSheet({ tourId, onOpenChange, onChanged }: { tourId: string | null; onOpenChange: (open: boolean) => void; onChanged?: () => void }) {
  const { session, scoped, openTour } = useDispatch();
  const router = useRouter();
  const { t: tr, fmt } = useI18n();
  const when = (iso?: string | null) => (iso ? fmt.dateTime(iso) : tr("common.dash"));
  const eventText = (e: TourEvent) => {
    let text = EVENT_KINDS.has(e.kind) ? tr(`tours.event.${e.kind}` as MessageKey) : e.kind;
    if (typeof e.detail?.reason === "string") text = tr("tours.rec.eventReason", { label: text, reason: e.detail.reason });
    if (e.kind === "rescheduled" && typeof e.detail?.toDate === "string") text = tr("tours.rec.eventMoved", { label: text, date: e.detail.toDate });
    return text;
  };
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
    <Sheet open={!!tourId} onOpenChange={onOpenChange} title={t ? tr("tours.rec.title", { name: t.name }) : tr("tours.rec.titleEmpty")} description={t ? `${depot?.name ?? ""} · ${t.date}` : undefined} className="max-w-lg">
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
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] g:gap-y-3">
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted g:mb-0.5 g:text-[12px]">{tr("tours.f.driver")}</dt>
              <dd className="font-semibold text-ink g:font-normal">{driver?.displayName ?? tr("common.dash")}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted g:mb-0.5 g:text-[12px]">{tr("tours.rec.plannedStart")}</dt>
              <dd className="font-semibold text-ink tabular g:font-normal">{formatClock(t.plannedStartMinute)}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted g:mb-0.5 g:text-[12px]">{tr("tours.rec.started")}</dt>
              <dd className="tabular">{when(t.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.08em] text-muted g:mb-0.5 g:text-[12px]">{t.status === "cancelled" ? tr("tours.rec.cancelled") : tr("tours.rec.finished")}</dt>
              <dd className="tabular">{when(t.closedAt ?? t.finishedAt)}</dd>
            </div>
            {t.closeReason && (
              <div className="col-span-2">
                <dt className="text-2xs uppercase tracking-[0.08em] text-muted g:mb-0.5 g:text-[12px]">{t.closedRemotely ? tr("tours.rec.reasonDispatch") : tr("tours.rec.reason")}</dt>
                <dd className="text-ink">{t.closeReason}</dd>
              </div>
            )}
            {t.archivedAt && (
              <div className="col-span-2">
                <dt className="text-2xs uppercase tracking-[0.08em] text-muted g:mb-0.5 g:text-[12px]">{tr("tours.rec.archived")}</dt>
                <dd>{tr("tours.rec.archivedAt", { when: when(t.archivedAt) })}</dd>
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
              <MapIcon /> {tr("tours.rec.openDay")}
            </Button>
          )}
          {t.archivedAt && (
            <p className="flex items-center gap-1.5 text-2xs text-muted">
              <ArchiveRestore className="size-3.5 g:hidden" /> {tr("tours.rec.restoreHint", { status: statusLabel(t.status, tr).toLowerCase() })}
            </p>
          )}
          <section aria-label={tr("tours.rec.stops")}>
            <h3 className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:mb-2 g:text-[13.5px] g:text-ink">
              {tr("tours.rec.stopsCount", { count: data.stops.length })}
            </h3>
            {data.stops.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-3 text-center text-[13px] text-muted">{tr("tours.rec.noStops")}</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line rounded-xl border border-line g:rounded-md">
                {data.stops.map((s, i) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[13px] g:py-1.5">
                    <span className="min-w-0">
                      <span className="me-1.5 text-muted tabular">{i + 1}.</span>
                      <span className="font-medium text-ink g:font-normal">{s.recipientName ?? s.address.street}</span>
                      <span className="block truncate text-2xs text-muted">
                        {s.address.street} {s.address.houseNumber ?? ""}, {s.address.postalCode} {s.address.city}
                      </span>
                      {s.cancelReason && <span className="block text-2xs text-danger-ink">{tr("tours.rec.stopCancelled", { reason: s.cancelReason })}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <Badge tone={STOP_STATUS[s.status].tone}>{stopStatusLabel(s.status, tr)}</Badge>
                      {s.completedAt && <span className="text-2xs text-muted tabular">{when(s.completedAt)}</span>}
                      {(s.proofs?.length ?? 0) > 0 && <span className="text-2xs text-muted">{tr("tours.rec.proofs", { count: s.proofs!.length })}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section aria-label={tr("tours.rec.history")}>
            <h3 className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:mb-2 g:text-[13.5px] g:text-ink">{tr("tours.rec.history")}</h3>
            <ol className="flex flex-col gap-1 text-[12.5px] g:gap-0 g:divide-y g:divide-line g:border-y g:border-line">
              {data.events
                .filter((e) => e.source === "tour")
                .map((e, i) => (
                  <li key={i} className="flex justify-between gap-3 g:py-1.5">
                    <span className="text-ink-2">{eventText(e)}</span>
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
