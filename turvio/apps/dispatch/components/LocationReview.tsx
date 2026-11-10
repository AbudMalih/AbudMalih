"use client";

import { formatClock, isOpen, minuteOfDay, type Stop, type TourSummary } from "@turvio/shared";
import { Badge, Button, Dialog, Input, toast } from "@turvio/web-ui/ds";
import { CheckCircle2, CircleAlert, History, Info, MapPin, Navigation, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../lib/api";
import { ACTION_LABEL, PRECISION_LABEL, checkStatusLabel, locationBadge, type LocationEvent, type LocationReport, type StopLocationDetail } from "../lib/locations";
import { useDispatch } from "../lib/store";
import { AddressSearch, type PickedPlace } from "./AddressSearch";
import { LocationPickerMap, pickStatus, type PickerMarker } from "./LocationPickerMap";

/** Approach points may be up to this far from the pin (same limit as the database). */
const APPROACH_LIMIT_M = 300;

const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const TONE = { error: "text-danger-ink", warning: "text-warning-ink", info: "text-muted" } as const;
const fmtAddr = (a: { street: string; houseNumber?: string; postalCode: string; city: string }) => `${a.street}${a.houseNumber ? ` ${a.houseNumber}` : ""}, ${a.postalCode} ${a.city}`;
const fmtPoint = (p: { lat: number; lng: number } | null) => (p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "no map position");
const at = (iso: string, tz: string | undefined) => `${iso.slice(0, 10)} ${formatClock(minuteOfDay(iso, tz ?? "UTC") ?? 0)}`;

/**
 * Location review of one stop (P0-3.4): check result, explicit actions, original vs current,
 * history. Nothing here changes a delivery address or moves a stop without a dispatcher's click –
 * a suggested approach point becomes the navigation target only through "Use as navigation approach".
 */
export function LocationReview({ summary, stop, report }: { summary: TourSummary; stop: Stop; report: LocationReport | undefined }) {
  const { moveStopPin, confirmStopLocation, acceptApproach, clearApproach, stopLocation, stopLocationHistory, scoped } = useDispatch();
  const published = !!summary.tour.publishedAt;
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Navigation approach dialog: open with an optional proposal (the check's suggestion); applied only on "Use this approach".
  const [approachOpen, setApproachOpen] = useState(false);
  const [approachPick, setApproachPick] = useState<{ lat: number; lng: number } | null>(null);
  const [original, setOriginal] = useState<StopLocationDetail["original"] | undefined>(undefined);
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<StopLocationDetail | null>(null);
  const [history, setHistory] = useState<LocationEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const open = isOpen(stop.status) && summary.tour.status !== "completed";
  const warnings = report?.issues.filter((i) => i.severity === "warning") ?? [];
  const badge = locationBadge(report);
  const reasonMissing = published && !reason.trim();
  const suggestion = report?.issues.find((i) => i.suggestion)?.suggestion;
  const refMarkers = (): PickerMarker[] => [
    ...(stop.location ? [{ point: stop.location, label: "Current pin", kind: "current" as const }] : []),
    ...(original?.location ? [{ point: original.location, label: original.kind === "original" ? "Original location" : "Earliest recorded location", kind: "original" as const }] : []),
    ...(suggestion ? [{ point: suggestion.location, label: `Suggested approach: ${suggestion.roadName || "unnamed road"}`, kind: "suggestion" as const }] : []),
    ...(report?.approach ? [{ point: { lat: report.approach.lat, lng: report.approach.lng }, label: "Current navigation approach", kind: "approach" as const }] : []),
  ];
  const moveStatus = pickStatus(picked ? { lat: picked.lat, lng: picked.lng } : null, stop.location ?? scoped.depots[0]!.location);
  const approachStatus = stop.location ? pickStatus(approachPick, stop.location, APPROACH_LIMIT_M) : { meters: null, allowed: false };

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      return true;
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-ink-2" data-testid="location-review">
      <div className="flex flex-wrap items-center gap-1.5">
        <MapPin className="size-3.5 text-subtle" />
        <span className="font-medium">Location</span>
        {badge && (
          <span data-testid="location-badge">
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </span>
        )}
        <span className="text-2xs text-subtle" data-testid="location-status">
          {report ? checkStatusLabel(report) : "Not checked yet"}
        </span>
      </div>

      {report && report.issues.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="location-issues">
          {report.issues.map((i) => {
            const Icon = ICON[i.severity];
            return (
              <li key={i.code} className={`flex items-start gap-1.5 ${TONE[i.severity]}`}>
                <Icon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {i.message}
                  {open && i.suggestion && !report.approach && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ms-2"
                      disabled={busy}
                      onClick={() => {
                        setApproachPick(i.suggestion!.location);
                        setApproachOpen(true);
                      }}
                    >
                      <Navigation /> Use as navigation approach…
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {report?.confirmation && (
        <div className="flex items-center gap-1.5 text-success-ink" data-testid="location-confirmation">
          <CheckCircle2 className="size-3.5" /> Confirmed {at(report.confirmation.at, scoped.timeZone)}
          {report.confirmation.note ? ` – ${report.confirmation.note}` : ""}
        </div>
      )}
      {report?.approach && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="location-approach">
          <Navigation className="size-3.5 text-brand-600" /> Drivers navigate to {report.approach.roadName || "the approach point"}
          {report.approach.distanceMeters != null ? ` (${report.approach.distanceMeters} m from the address)` : ""} · the address and pin stay unchanged
          {open && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act("Navigation approach removed", () => clearApproach(stop))}>
              Remove
            </Button>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setMoving(true);
              // The original location is shown on the map for reference (staff only).
              if (original === undefined) void stopLocation(stop.id).then((d) => setOriginal(d.original)).catch(() => setOriginal(null));
            }}
            disabled={busy}
          >
            <MapPin /> Move pin…
          </Button>
          {stop.location && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setApproachPick(report?.approach ? { lat: report.approach.lat, lng: report.approach.lng } : (suggestion?.location ?? null));
                setApproachOpen(true);
              }}
              disabled={busy}
              data-testid="choose-approach"
            >
              <Navigation /> {report?.approach ? "Change navigation approach…" : "Choose navigation approach…"}
            </Button>
          )}
          {stop.location && warnings.length > 0 && !report?.acknowledged && report?.status !== "pending" && (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)} disabled={busy} data-testid="confirm-location">
              <CheckCircle2 /> Location is correct…
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                setDetail(detail ? null : await stopLocation(stop.id));
              } catch (e) {
                toast.error("Could not load", { description: errorMessage(e) });
              }
            }}
          >
            {detail ? "Hide original" : "Original vs current"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                setHistory(history ? null : await stopLocationHistory(stop.id));
              } catch (e) {
                toast.error("Could not load", { description: errorMessage(e) });
              }
            }}
          >
            <History /> {history ? "Hide history" : "History"}
          </Button>
        </div>
      )}

      {detail && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-2xs" data-testid="location-original">
          <dt className="text-subtle">{detail.original?.label ?? "Original"}</dt>
          <dd>{detail.original ? `${fmtAddr(detail.original.address)} · ${fmtPoint(detail.original.location)} · ${PRECISION_LABEL[detail.original.locationPrecision] ?? detail.original.locationPrecision}` : "not recorded"}</dd>
          <dt className="text-subtle">Current</dt>
          <dd>
            {fmtAddr(detail.current.address)} · {fmtPoint(detail.current.location)} · {PRECISION_LABEL[detail.current.locationPrecision] ?? detail.current.locationPrecision}
          </dd>
        </dl>
      )}
      {history && (
        <ol className="flex flex-col gap-0.5 text-2xs" data-testid="location-history">
          {history.length === 0 && <li className="text-subtle">No changes recorded.</li>}
          {history.map((e) => (
            <li key={e.id}>
              <span className="text-subtle">{at(e.at, scoped.timeZone)}</span> · {ACTION_LABEL[e.action] ?? e.action} · {e.actor.role}
              {e.reason ? ` – “${e.reason}”` : ""}
            </li>
          ))}
        </ol>
      )}

      <Dialog
        open={moving}
        onOpenChange={(o) => {
          setMoving(o);
          if (!o) setPicked(null);
        }}
        title="Move the map pin"
        description="Click the map (or drag the blue point) – or search a place. Only the map position changes; the delivery address stays as it is and the original location is kept in the history."
        footer={
          <Button
            disabled={!picked || reasonMissing || busy}
            onClick={async () => {
              if (!picked) return;
              const ok = await act("Pin moved", () =>
                moveStopPin(stop, { lat: picked.lat, lng: picked.lng }, { reason: reason.trim() || undefined, precision: !picked.precision || picked.precision === "other" ? "manual_pin" : picked.precision }),
              );
              if (ok) {
                setMoving(false);
                setPicked(null);
                setReason("");
              }
            }}
          >
            <MapPin /> Move pin
          </Button>
        }
      >
        <div className="flex flex-col gap-2 text-[13px]">
          {moving && (
            <LocationPickerMap
              center={stop.location ?? original?.location ?? scoped.depots[0]!.location}
              markers={refMarkers().filter((m) => m.kind !== "suggestion" && m.kind !== "approach")}
              value={picked ? { lat: picked.lat, lng: picked.lng } : null}
              onPick={(p) => setPicked({ ...p, label: `Map point ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` })}
            />
          )}
          <AddressSearch near={stop.location ?? undefined} onPick={setPicked} placeholder="…or search a place / type coordinates (52.37, 9.73)" />
          {picked && (
            <div className="text-xs text-muted" data-testid="move-pin-summary">
              New position: {picked.label}
              {moveStatus.meters !== null && stop.location ? ` · ${moveStatus.meters} m from the current pin` : ""}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium text-ink-2">Reason{published ? " (required – the tour is published)" : " (optional)"}</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" maxLength={500} />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Confirm this location"
        description={`You confirm the pin at ${fmtPoint(stop.location)} for this address despite: ${warnings.map((w) => w.message).join(" ")} The confirmation ends if the address or pin changes.`}
        footer={
          <Button
            disabled={busy}
            onClick={async () => {
              const ok = await act("Location confirmed", () => confirmStopLocation(stop, warnings.map((w) => w.code), note.trim() || undefined));
              if (ok) {
                setConfirming(false);
                setNote("");
              }
            }}
          >
            <CheckCircle2 /> Confirm
          </Button>
        }
      >
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium text-ink-2">Note (optional)</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" maxLength={500} />
        </label>
      </Dialog>

      <Dialog
        open={approachOpen}
        onOpenChange={(o) => {
          setApproachOpen(o);
          if (!o) setApproachPick(null);
        }}
        title="Navigation approach"
        description={`Where drivers and routing should go for this stop – click the map within ${APPROACH_LIMIT_M} m of the pin (dashed circle) or the green suggestion. The delivery address and the pin stay unchanged. Valid until the address or pin changes.`}
        footer={
          <Button
            disabled={busy || reasonMissing || !approachStatus.allowed}
            onClick={async () => {
              if (!approachPick) return;
              const ok = await act("Navigation approach set", () => acceptApproach(stop, approachPick, reason.trim() || undefined));
              if (ok) {
                setApproachOpen(false);
                setApproachPick(null);
                setReason("");
              }
            }}
          >
            <Navigation /> Use this approach
          </Button>
        }
      >
        <div className="flex flex-col gap-2 text-[13px]">
          {approachOpen && stop.location && <LocationPickerMap center={stop.location} limit={APPROACH_LIMIT_M} markers={refMarkers()} value={approachPick} onPick={setApproachPick} />}
          <div className="text-xs text-muted" data-testid="approach-summary">
            {approachPick
              ? approachStatus.allowed
                ? `${approachStatus.meters} m from the pin${suggestion && approachPick.lat === suggestion.location.lat && approachPick.lng === suggestion.location.lng ? ` · suggested: ${suggestion.roadName || "unnamed road"}` : ""} – the server checks that it is on a normal road.`
                : `${approachStatus.meters} m from the pin – more than ${APPROACH_LIMIT_M} m, choose a closer point.`
              : "No point chosen yet."}
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-ink-2">Reason{published ? " (required – the tour is published)" : " (optional)"}</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Approach reason" maxLength={500} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}

