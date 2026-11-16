"use client";

import { can, formatClock, parseMinuteOfDay, type Tour } from "@turvio/shared";
import { Button, Checkbox, Dialog, Input, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, cn, toast } from "@turvio/web-ui/ds";
import { Archive, ArchiveRestore, Ban, CheckCircle2, Copy, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Send, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import type { MessageKey } from "../lib/i18n";
import { useI18n, useT } from "../lib/i18n/client";
import { availableActions, lifecycleApi, reasonText, statusLabel, type DeleteEligibility } from "../lib/lifecycle";
import { useDispatch } from "../lib/store";

/*
 * Contextual tour actions (Planning, Tours, tour drawers). Only actions that apply to the tour's
 * state and the user's role are offered; the server re-checks every one of them.
 */

export interface ActionTour {
  tour: Tour;
  depotName?: string;
  driverName?: string | null;
  /** Number of stops on the tour (if known). */
  stopCount?: number;
  /** Open stops (pending / in progress), if known. */
  openStops?: number;
}

type Dialogs = null | "edit" | "duplicate" | "finish" | "cancel" | "archive" | "restore" | "delete" | "publish" | "withdraw";

const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** "More" menu + the dialogs it opens. `onChanged` refreshes the caller's list; the day view reloads too. */
export function TourActionsMenu({ item, onChanged, onOpen, onDeleted, trigger, align = "end" }: { item: ActionTour; onChanged?: () => void; onOpen?: () => void; onDeleted?: () => void; trigger?: ReactNode; align?: "start" | "end" }) {
  const { session } = useDispatch();
  const tr = useT();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const t = item.tour;
  const a = availableActions(t, item.stopCount ?? 0);
  const role = session.role;
  const may = { manage: can(role, "tours.manage"), close: can(role, "tours.close"), archive: can(role, "tours.archive"), del: can(role, "tours.delete") };
  const items: ReactNode[] = [];
  if (onOpen) items.push(<MenuItem key="open" icon={<Eye />} onSelect={onOpen}>{tr("tours.a.viewDetails")}</MenuItem>);
  if (may.manage && a.edit) items.push(<MenuItem key="edit" icon={<Pencil />} onSelect={() => setDialog("edit")}>{tr("tours.a.edit")}</MenuItem>);
  if (may.manage) items.push(<MenuItem key="dup" icon={<Copy />} onSelect={() => setDialog("duplicate")}>{tr("tours.a.duplicate")}</MenuItem>);
  if (may.manage && a.publish) items.push(<MenuItem key="pub" icon={<Send />} onSelect={() => setDialog("publish")}>{tr("tours.a.publish")}</MenuItem>);
  if (may.manage && a.withdraw) items.push(<MenuItem key="wd" icon={<EyeOff />} onSelect={() => setDialog("withdraw")}>{tr("tours.a.withdraw")}</MenuItem>);
  const closing: ReactNode[] = [];
  if (may.close && a.finish) closing.push(<MenuItem key="fin" icon={<CheckCircle2 />} onSelect={() => setDialog("finish")}>{tr("tours.a.finish")}</MenuItem>);
  if (may.close && a.cancel) closing.push(<MenuItem key="can" icon={<Ban />} onSelect={() => setDialog("cancel")}>{tr("tours.a.cancel")}</MenuItem>);
  const keeping: ReactNode[] = [];
  if (may.archive && a.archive) keeping.push(<MenuItem key="arc" icon={<Archive />} onSelect={() => setDialog("archive")}>{tr("tours.a.archive")}</MenuItem>);
  if (may.archive && a.restore) keeping.push(<MenuItem key="res" icon={<ArchiveRestore />} onSelect={() => setDialog("restore")}>{tr("tours.a.restore")}</MenuItem>);
  if (may.del && a.delete)
    keeping.push(
      <MenuItem key="del" icon={<Trash2 />} className="text-danger-ink" onSelect={() => setDialog("delete")}>
        {tr("tours.a.delete")}
      </MenuItem>,
    );

  const close = () => setDialog(null);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon-sm" aria-label={tr("tours.a.actionsFor", { name: t.name })} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </Button>
          )}
        </MenuTrigger>
        <MenuContent align={align} className="w-60" onClick={(e) => e.stopPropagation()}>
          <MenuLabel>{t.name}</MenuLabel>
          {items}
          {closing.length > 0 && <MenuSeparator />}
          {closing}
          {keeping.length > 0 && <MenuSeparator />}
          {keeping}
          {items.length + closing.length + keeping.length === 0 && <MenuItem disabled>{tr("tours.a.none")}</MenuItem>}
        </MenuContent>
      </Menu>
      {dialog === "edit" && <EditTourDialog item={item} onClose={close} onChanged={onChanged} />}
      {dialog === "duplicate" && <DuplicateTourDialog item={item} onClose={close} onChanged={onChanged} />}
      {(dialog === "finish" || dialog === "cancel") && <CloseTourDialog item={item} mode={dialog} onClose={close} onChanged={onChanged} />}
      {(dialog === "archive" || dialog === "restore" || dialog === "publish" || dialog === "withdraw") && <SimpleTourAction item={item} action={dialog} onClose={close} onChanged={onChanged} />}
      {dialog === "delete" && <DeleteTourDialog item={item} onClose={close} onChanged={onChanged} onDeleted={onDeleted} />}
    </>
  );
}

/** Runs an action, reloads list + day view, reports the outcome. Returns false on failure. */
function useAction(onChanged?: () => void) {
  const { reload } = useDispatch();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string, failTitle: string): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(failTitle, { description: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
      onChanged?.();
      void reload().catch(() => undefined);
    }
  };
  return { busy, run };
}

function Footer({ busy, onCancel, onConfirm, label, tone = "primary", disabled }: { busy: boolean; onCancel: () => void; onConfirm: () => void; label: string; tone?: "primary" | "danger"; disabled?: boolean }) {
  const t = useT();
  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        {t("common.cancel")}
      </Button>
      <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy || disabled}>
        {busy && <Loader2 className="animate-spin" />}
        {label}
      </Button>
    </>
  );
}

function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-medium text-ink-2", className)}>
      {label}
      {children}
      {hint && <span className="text-2xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- edit / reschedule
export function EditTourDialog({ item, onClose, onChanged }: { item: ActionTour; onClose: () => void; onChanged?: () => void }) {
  const { scoped, session } = useDispatch();
  const tr = useT();
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const canMove = t.status === "planned";
  const [name, setName] = useState(t.name);
  const [start, setStart] = useState(formatClock(t.plannedStartMinute));
  const [date, setDate] = useState(t.date);
  const [depot, setDepot] = useState(t.depotId);
  const [driver, setDriver] = useState(t.driverId ?? "");
  const [vehicle, setVehicle] = useState(t.vehicleId ?? "");
  const { busy, run } = useAction(onChanged);
  const startMinute = parseMinuteOfDay(start);
  const drivers = scoped.drivers.filter((d) => d.active && (d.depotId === depot || d.id === t.driverId));
  const vehicles = scoped.vehicles.filter((v) => v.depotId === depot || v.id === t.vehicleId);
  const patch: Parameters<typeof api.update>[1] = {};
  if (name.trim() && name.trim() !== t.name) patch.name = name.trim();
  if (startMinute !== null && startMinute !== t.plannedStartMinute) patch.plannedStartMinute = startMinute;
  if (canMove && date !== t.date) patch.date = date;
  if (canMove && depot !== t.depotId) patch.depotId = depot;
  if ((driver || null) !== t.driverId) patch.driverId = driver || null;
  if ((vehicle || null) !== t.vehicleId) patch.vehicleId = vehicle || null;
  const changed = Object.keys(patch).length > 0;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={tr("tours.edit.title", { name: t.name })}
      description={t.publishedAt ? tr("tours.edit.descPublished") : tr("tours.edit.descDraft")}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          label={tr("tours.edit.save")}
          disabled={!changed || startMinute === null || !name.trim()}
          onConfirm={async () => {
            if (await run(() => api.update(t, patch), tr("tours.edit.saved", { name: t.name }), tr("tours.a.notSaved"))) onClose();
          }}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={tr("tours.f.name")} className="sm:col-span-2">
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label={tr("tours.f.tourName")} />
        </Field>
        <Field label={tr("tours.f.date")} hint={canMove ? undefined : tr("tours.edit.onlyDate")}>
          <input type="date" className={fieldCls} value={date} disabled={!canMove} onChange={(e) => setDate(e.target.value)} aria-label={tr("tours.f.tourDate")} />
        </Field>
        <Field label={tr("tours.f.startTime")}>
          <input type="time" dir="ltr" className={cn(fieldCls, startMinute === null && "border-danger")} value={start} onChange={(e) => setStart(e.target.value)} aria-label={tr("tours.f.startTime")} />
        </Field>
        <Field label={tr("tours.f.location")} hint={canMove ? undefined : tr("tours.edit.onlyLocation")}>
          <select className={fieldCls} value={depot} disabled={!canMove} onChange={(e) => (setDepot(e.target.value), setDriver(""), setVehicle(""))} aria-label={tr("tours.f.location")}>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr("tours.f.driver")}>
          <select className={fieldCls} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label={tr("tours.f.driver")}>
            <option value="">{tr("tours.edit.noDriver")}</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr("tours.f.vehicle")} className="sm:col-span-2">
          <select className={fieldCls} value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label={tr("tours.f.vehicle")}>
            <option value="">{tr("tours.edit.noVehicle")}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.licensePlate}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- duplicate
function DuplicateTourDialog({ item, onClose, onChanged }: { item: ActionTour; onClose: () => void; onChanged?: () => void }) {
  const { scoped, session } = useDispatch();
  const tr = useT();
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const [date, setDate] = useState(plusDays(t.date, 1));
  const [name, setName] = useState(tr("tours.dup.copyName", { name: t.name }).slice(0, 120));
  const [includeStops, setIncludeStops] = useState(true);
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const { busy, run } = useAction(onChanged);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={tr("tours.dup.title", { name: t.name })}
      description={tr("tours.dup.desc")}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          label={tr("tours.dup.create")}
          disabled={!date || !name.trim()}
          onConfirm={async () => {
            let copied = 0;
            const ok = await run(
              async () => {
                copied = (await api.duplicate(t.id, { date, name: name.trim(), driverId: driver || null, vehicleId: vehicle || null, includeStops })).stops;
              },
              tr("tours.dup.created", { name: t.name }),
              tr("tours.dup.failed"),
            );
            if (ok) {
              if (includeStops) toast.message(tr("tours.dup.copied", { count: copied, date }));
              onClose();
            }
          }}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={tr("tours.f.name")} className="sm:col-span-2">
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label={tr("tours.dup.nameAria")} />
        </Field>
        <Field label={tr("tours.f.date")}>
          <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} aria-label={tr("tours.dup.dateAria")} />
        </Field>
        <Field label={tr("tours.f.driver")} hint={tr("tours.dup.driverHint")}>
          <select className={fieldCls} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label={tr("tours.dup.driverAria")}>
            <option value="">{tr("tours.dup.assignLater")}</option>
            {scoped.drivers
              .filter((d) => d.active && d.depotId === t.depotId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tr("tours.f.vehicle")} className="sm:col-span-2">
          <select className={fieldCls} value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label={tr("tours.dup.vehicleAria")}>
            <option value="">{tr("tours.dup.assignLater")}</option>
            {scoped.vehicles
              .filter((v) => v.depotId === t.depotId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {v.licensePlate}
                </option>
              ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[13px] text-ink-2 sm:col-span-2">
          <Checkbox checked={includeStops} onCheckedChange={(c) => setIncludeStops(c === true)} label={tr("tours.dup.copyStops")} />
          {item.stopCount !== undefined ? tr("tours.dup.copyStopsCount", { count: item.stopCount }) : tr("tours.dup.copyStopsAll")}
        </label>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- finish / cancel
export function CloseTourDialog({ item, mode, onClose, onChanged }: { item: ActionTour; mode: "finish" | "cancel"; onClose: () => void; onChanged?: () => void }) {
  const { session } = useDispatch();
  const { t: tr, tr: trNode } = useI18n();
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const [reason, setReason] = useState("");
  const [openStops, setOpenStops] = useState<"return" | "cancel">("return");
  const { busy, run } = useAction(onChanged);
  const running = t.status === "in_progress" || t.status === "paused";
  const valid = reason.trim().length >= 3;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={mode === "finish" ? tr("tours.close.titleFinish", { name: t.name }) : tr("tours.close.titleCancel", { name: t.name })}
      description={mode === "finish" ? tr("tours.close.descFinish") : tr("tours.close.descCancel")}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          tone={mode === "cancel" ? "danger" : "primary"}
          label={mode === "finish" ? tr("tours.close.finish") : tr("tours.close.cancel")}
          disabled={!valid}
          onConfirm={async () => {
            let summary = "";
            const ok = await run(
              async () => {
                const r = await api.close(t, mode === "finish" ? "completed" : "cancelled", reason.trim(), openStops);
                summary =
                  r.openStops.action === "returned_to_pool"
                    ? tr("tours.close.returned", { count: r.openStops.count })
                    : r.openStops.action === "cancelled"
                      ? tr("tours.close.cancelledStops", { count: r.openStops.count })
                      : tr("tours.close.noOpen");
              },
              mode === "finish" ? tr("tours.close.finished", { name: t.name }) : tr("tours.close.cancelled", { name: t.name }),
              mode === "finish" ? tr("tours.close.notFinished") : tr("tours.close.notCancelled"),
            );
            if (ok) {
              toast.message(summary);
              onClose();
            }
          }}
        />
      }
    >
      <div className="flex flex-col gap-3 text-[13px] text-ink-2">
        {running && t.publishedAt && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-warning-ink">
            {tr(mode === "finish" ? "tours.close.warnFinish" : "tours.close.warnCancel", { driver: item.driverName ?? tr("tours.close.theDriver") })}
          </p>
        )}
        <Field label={tr("tours.close.reasonLabel")}>
          <textarea
            className={cn(fieldCls, "h-20 py-2")}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            aria-label={tr("tours.close.reason")}
            placeholder={mode === "finish" ? tr("tours.close.phFinish") : tr("tours.close.phCancel")}
          />
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 font-medium">{item.openStops !== undefined ? tr("tours.close.openStopsCount", { count: item.openStops }) : tr("tours.close.openStops")}</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="openStops" checked={openStops === "return"} onChange={() => setOpenStops("return")} className="mt-1" />
            <span>
              {trNode("tours.close.returnOpt", { label: <span className="font-medium text-ink">{tr("tours.close.returnLabel")}</span> })}
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="openStops" checked={openStops === "cancel"} onChange={() => setOpenStops("cancel")} className="mt-1" />
            <span>
              {trNode("tours.close.cancelOpt", { label: <span className="font-medium text-ink">{tr("tours.close.cancelLabel")}</span> })}
            </span>
          </label>
        </fieldset>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- archive / restore / publish / withdraw
function SimpleTourAction({ item, action, onClose, onChanged }: { item: ActionTour; action: "archive" | "restore" | "publish" | "withdraw"; onClose: () => void; onChanged?: () => void }) {
  const { session } = useDispatch();
  const tr = useT();
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const { busy, run } = useAction(onChanged);
  const k = (part: "title" | "body" | "label" | "ok" | "failed") => `tours.simple.${action}.${part}` as MessageKey;
  const params = { name: t.name, status: statusLabel(t.status, tr).toLowerCase(), driver: item.driverName ?? tr("tours.close.theDriver") };
  const fn = { archive: () => api.archive(t), restore: () => api.restore(t), publish: () => api.publish(t), withdraw: () => api.withdraw(t) }[action];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={tr(k("title"), params)}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          label={tr(k("label"))}
          onConfirm={async () => {
            if (await run(fn, tr(k("ok"), params), tr(k("failed")))) onClose();
          }}
        />
      }
    >
      <p className="text-[13px] text-ink-2">{tr(k("body"), params)}</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- permanent delete
const RECORD_KEYS: (keyof DeleteEligibility & ("processedStops" | "stopEvents" | "proofs" | "scannedParcels" | "locationPoints"))[] = [
  "processedStops",
  "stopEvents",
  "proofs",
  "scannedParcels",
  "locationPoints",
];

export function DeleteTourDialog({ item, onClose, onChanged, onDeleted }: { item: ActionTour; onClose: () => void; onChanged?: () => void; onDeleted?: () => void }) {
  const { session } = useDispatch();
  const tr = useT();
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const [e, setE] = useState<DeleteEligibility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteStops, setDeleteStops] = useState(false);
  const { busy, run } = useAction(onChanged);
  useEffect(() => {
    let alive = true;
    api.eligibility(t.id).then(
      (r) => alive && setE(r),
      (err) => alive && setLoadError(errorMessage(err)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id]);
  const protectedRecords = e ? RECORD_KEYS.filter((k) => e[k] > 0) : [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={tr("tours.del.title", { name: t.name })}
      description={tr("tours.del.desc")}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          tone="danger"
          label={tr("tours.del.label")}
          disabled={!e?.eligible}
          onConfirm={async () => {
            if (await run(() => api.remove({ id: t.id, version: e!.tour.version }, deleteStops), tr("tours.del.deleted", { name: t.name }), tr("tours.del.failed"))) {
              onClose();
              onDeleted?.();
            }
          }}
        />
      }
    >
      {!e && !loadError && (
        <p className="flex items-center gap-2 text-[13px] text-muted" aria-busy="true">
          <Loader2 className="size-4 animate-spin" /> {tr("tours.del.checking")}
        </p>
      )}
      {loadError && <p className="text-[13px] text-danger-ink">{loadError}</p>}
      {e && (
        <div className="flex flex-col gap-3 text-[13px] text-ink-2" data-testid="delete-preview">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">{tr("tours.del.tour")}</dt>
            <dd className="font-semibold text-ink">{e.tour.name}</dd>
            <dt className="text-muted">{tr("tours.f.date")}</dt>
            <dd>{e.tour.date}</dd>
            <dt className="text-muted">{tr("tours.f.driver")}</dt>
            <dd>{e.tour.driverName ?? tr("common.dash")}</dd>
            <dt className="text-muted">{tr("tours.del.stops")}</dt>
            <dd className="tabular">{e.stops}</dd>
            <dt className="text-muted">{tr("tours.del.completedDeliveries")}</dt>
            <dd className="tabular">{e.completedDeliveries}</dd>
          </dl>
          {e.eligible ? (
            <>
              <p className="rounded-md bg-success-soft px-3 py-2 text-success-ink">{tr("tours.del.eligible")}</p>
              {e.stops > 0 && (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 font-medium">{tr("tours.del.unprocessed", { count: e.stops })}</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="deleteStops" checked={!deleteStops} onChange={() => setDeleteStops(false)} />
                    {tr("tours.del.returnThem")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="deleteStops" checked={deleteStops} onChange={() => setDeleteStops(true)} />
                    {tr("tours.del.deleteThem")}
                  </label>
                </fieldset>
              )}
              <p className="text-2xs text-muted">{tr("tours.del.recorded")}</p>
            </>
          ) : (
            <div className="flex flex-col gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger-ink" role="alert">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="size-4" /> {tr("tours.del.protected")}
              </p>
              <ul className="list-disc ps-5">
                {e.reasons.map((r) => (
                  <li key={r}>{tr("tours.del.reasonLine", { reason: reasonText(r, tr) })}</li>
                ))}
              </ul>
              {protectedRecords.length > 0 && (
                <p>{tr("tours.del.records", { list: protectedRecords.map((k) => tr(`tours.del.${k}`, { count: e[k] })).join(" · ") })}</p>
              )}
              <p className="text-ink-2">
                {e.tour.status === "planned" && e.reasons.length === 1 && e.reasons[0] === "published"
                  ? tr("tours.del.withdrawFirst")
                  : tr("tours.del.archiveInstead")}
              </p>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
