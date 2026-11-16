"use client";

import { formatClock, isOpen, minuteOfDay, type Stop, type TourSummary } from "@turvio/shared";
import { Badge, Button, Dialog, Input, toast } from "@turvio/web-ui/ds";
import { CheckCircle2, CircleAlert, History, Info, MapPin, Navigation, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../lib/api";
import { actionLabel, checkStatusLabel, locationBadge, precisionLabel, type LocationEvent, type LocationReport, type StopLocationDetail } from "../lib/locations";
import type { TFunction } from "../lib/i18n";
import { useT } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { AddressSearch, type PickedPlace } from "./AddressSearch";
import { LocationPickerMap, pickStatus, type PickerMarker } from "./LocationPickerMap";

/** Approach points may be up to this far from the pin (same limit as the database). */
const APPROACH_LIMIT_M = 300;

const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const TONE = { error: "text-danger-ink", warning: "text-warning-ink", info: "text-muted" } as const;
const fmtAddr = (a: { street: string; houseNumber?: string; postalCode: string; city: string }) => `${a.street}${a.houseNumber ? ` ${a.houseNumber}` : ""}, ${a.postalCode} ${a.city}`;
const fmtPoint = (p: { lat: number; lng: number } | null, t: TFunction) => (p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : t("map.lr.noMapPosition"));
const ROLES = new Set(["owner", "admin", "dispatcher", "driver", "viewer"]);
/** A known role in the current language; any other actor (e.g. a system process) as recorded. */
const roleLabel = (role: string, t: TFunction) => (ROLES.has(role) ? t(`common.role.${role as "owner"}`) : role);
const at = (iso: string, tz: string | undefined) => `${iso.slice(0, 10)} ${formatClock(minuteOfDay(iso, tz ?? "UTC") ?? 0)}`;

/**
 * Location review of one stop (P0-3.4): check result, explicit actions, original vs current,
 * history. Nothing here changes a delivery address or moves a stop without a dispatcher's click –
 * a suggested approach point becomes the navigation target only through "Use as navigation approach".
 */
export function LocationReview({ summary, stop, report }: { summary: TourSummary; stop: Stop; report: LocationReport | undefined }) {
  const { moveStopPin, confirmStopLocation, acceptApproach, clearApproach, stopLocation, stopLocationHistory, scoped } = useDispatch();
  const t = useT();
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
  const badge = locationBadge(report, t);
  const reasonMissing = published && !reason.trim();
  const suggestion = report?.issues.find((i) => i.suggestion)?.suggestion;
  const refMarkers = (): PickerMarker[] => [
    ...(stop.location ? [{ point: stop.location, label: t("map.lr.currentPin"), kind: "current" as const }] : []),
    ...(original?.location ? [{ point: original.location, label: original.kind === "original" ? t("map.lr.originalLocation") : t("map.lr.earliestLocation"), kind: "original" as const }] : []),
    ...(suggestion ? [{ point: suggestion.location, label: t("map.lr.suggestedApproach", { road: suggestion.roadName || t("map.lr.unnamedRoad") }), kind: "suggestion" as const }] : []),
    ...(report?.approach ? [{ point: { lat: report.approach.lat, lng: report.approach.lng }, label: t("map.lr.currentApproach"), kind: "approach" as const }] : []),
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
      toast.error(t("map.lr.notSaved"), { description: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-ink-2" data-testid="location-review">
      <div className="flex flex-wrap items-center gap-1.5">
        <MapPin className="size-3.5 text-subtle" />
        <span className="font-medium">{t("map.lr.location")}</span>
        {badge && (
          <span data-testid="location-badge">
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </span>
        )}
        <span className="text-2xs text-subtle" data-testid="location-status">
          {report ? checkStatusLabel(report, t) : t("map.lr.notChecked")}
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
                      <Navigation /> {t("map.lr.useApproach")}
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
          <CheckCircle2 className="size-3.5" /> {t("map.lr.confirmed", { at: at(report.confirmation.at, scoped.timeZone) })}
          {report.confirmation.note ? ` – ${report.confirmation.note}` : ""}
        </div>
      )}
      {report?.approach && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="location-approach">
          <Navigation className="size-3.5 text-brand-600" />{" "}
          {t("map.lr.approachLine", {
            road: report.approach.roadName || t("map.lr.approachPoint"),
            distance: report.approach.distanceMeters != null ? t("map.lr.approachDistance", { n: report.approach.distanceMeters }) : "",
          })}
          {open && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(t("map.action.approach_cleared"), () => clearApproach(stop))}>
              {t("common.remove")}
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
            <MapPin /> {t("map.lr.movePinMenu")}
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
              <Navigation /> {report?.approach ? t("map.lr.changeApproach") : t("map.lr.chooseApproach")}
            </Button>
          )}
          {stop.location && warnings.length > 0 && !report?.acknowledged && report?.status !== "pending" && (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)} disabled={busy} data-testid="confirm-location">
              <CheckCircle2 /> {t("map.lr.locationCorrect")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                setDetail(detail ? null : await stopLocation(stop.id));
              } catch (e) {
                toast.error(t("map.lr.couldNotLoad"), { description: errorMessage(e) });
              }
            }}
          >
            {detail ? t("map.lr.hideOriginal") : t("map.lr.originalVsCurrent")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                setHistory(history ? null : await stopLocationHistory(stop.id));
              } catch (e) {
                toast.error(t("map.lr.couldNotLoad"), { description: errorMessage(e) });
              }
            }}
          >
            <History /> {history ? t("map.lr.hideHistory") : t("map.lr.history")}
          </Button>
        </div>
      )}

      {detail && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-2xs" data-testid="location-original">
          <dt className="text-subtle">{detail.original?.label ?? t("map.lr.original")}</dt>
          <dd>
            {detail.original
              ? `${fmtAddr(detail.original.address)} · ${fmtPoint(detail.original.location, t)} · ${precisionLabel(detail.original.locationPrecision, t)}`
              : t("map.lr.notRecorded")}
          </dd>
          <dt className="text-subtle">{t("map.lr.current")}</dt>
          <dd>
            {fmtAddr(detail.current.address)} · {fmtPoint(detail.current.location, t)} · {precisionLabel(detail.current.locationPrecision, t)}
          </dd>
        </dl>
      )}
      {history && (
        <ol className="flex flex-col gap-0.5 text-2xs" data-testid="location-history">
          {history.length === 0 && <li className="text-subtle">{t("map.lr.noChanges")}</li>}
          {history.map((e) => (
            <li key={e.id}>
              <span className="text-subtle">{at(e.at, scoped.timeZone)}</span> · {actionLabel(e.action, t)} · {roleLabel(e.actor.role, t)}
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
        title={t("map.lr.moveTitle")}
        description={t("map.lr.moveDesc")}
        footer={
          <Button
            disabled={!picked || reasonMissing || busy}
            onClick={async () => {
              if (!picked) return;
              const ok = await act(t("map.action.location_changed"), () =>
                moveStopPin(stop, { lat: picked.lat, lng: picked.lng }, { reason: reason.trim() || undefined, precision: !picked.precision || picked.precision === "other" ? "manual_pin" : picked.precision }),
              );
              if (ok) {
                setMoving(false);
                setPicked(null);
                setReason("");
              }
            }}
          >
            <MapPin /> {t("map.lr.movePin")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2 text-[13px]">
          {moving && (
            <LocationPickerMap
              center={stop.location ?? original?.location ?? scoped.depots[0]!.location}
              markers={refMarkers().filter((m) => m.kind !== "suggestion" && m.kind !== "approach")}
              value={picked ? { lat: picked.lat, lng: picked.lng } : null}
              onPick={(p) => setPicked({ ...p, label: t("map.lr.mapPoint", { coords: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` }) })}
            />
          )}
          <AddressSearch near={stop.location ?? undefined} onPick={setPicked} placeholder={t("map.lr.searchPlaceholder")} />
          {picked && (
            <div className="text-xs text-muted" data-testid="move-pin-summary">
              {moveStatus.meters !== null && stop.location
                ? t("map.lr.newPositionDist", { label: picked.label, n: moveStatus.meters })
                : t("map.lr.newPosition", { label: picked.label })}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium text-ink-2">{published ? t("map.lr.reasonRequired") : t("map.lr.reasonOptional")}</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t("map.lr.reason")} maxLength={500} />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("map.lr.confirmTitle")}
        // The warning texts come from the location check (API) as they are.
        description={t("map.lr.confirmDesc", { point: fmtPoint(stop.location, t), warnings: warnings.map((w) => w.message).join(" ") })}
        footer={
          <Button
            disabled={busy}
            onClick={async () => {
              const ok = await act(t("map.action.confirmed"), () => confirmStopLocation(stop, warnings.map((w) => w.code), note.trim() || undefined));
              if (ok) {
                setConfirming(false);
                setNote("");
              }
            }}
          >
            <CheckCircle2 /> {t("common.confirm")}
          </Button>
        }
      >
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium text-ink-2">{t("map.lr.noteOptional")}</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} aria-label={t("map.lr.note")} maxLength={500} />
        </label>
      </Dialog>

      <Dialog
        open={approachOpen}
        onOpenChange={(o) => {
          setApproachOpen(o);
          if (!o) setApproachPick(null);
        }}
        title={t("map.lr.approachTitle")}
        description={t("map.lr.approachDesc", { limit: APPROACH_LIMIT_M })}
        footer={
          <Button
            disabled={busy || reasonMissing || !approachStatus.allowed}
            onClick={async () => {
              if (!approachPick) return;
              const ok = await act(t("map.action.approach_accepted"), () => acceptApproach(stop, approachPick, reason.trim() || undefined));
              if (ok) {
                setApproachOpen(false);
                setApproachPick(null);
                setReason("");
              }
            }}
          >
            <Navigation /> {t("map.lr.useThisApproach")}
          </Button>
        }
      >
        <div className="flex flex-col gap-2 text-[13px]">
          {approachOpen && stop.location && <LocationPickerMap center={stop.location} limit={APPROACH_LIMIT_M} markers={refMarkers()} value={approachPick} onPick={setApproachPick} />}
          <div className="text-xs text-muted" data-testid="approach-summary">
            {approachPick
              ? approachStatus.allowed
                ? suggestion && approachPick.lat === suggestion.location.lat && approachPick.lng === suggestion.location.lng
                  ? t("map.lr.approachOkSuggested", { n: approachStatus.meters, road: suggestion.roadName || t("map.lr.unnamedRoad") })
                  : t("map.lr.approachOk", { n: approachStatus.meters })
                : t("map.lr.approachTooFar", { n: approachStatus.meters, limit: APPROACH_LIMIT_M })
              : t("map.lr.noPoint")}
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-ink-2">{published ? t("map.lr.reasonRequired") : t("map.lr.reasonOptional")}</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t("map.lr.approachReason")} maxLength={500} />
          </label>
        </div>
      </Dialog>
    </div>
  );
}

