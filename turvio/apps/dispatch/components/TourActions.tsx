"use client";

import { can, formatClock, parseMinuteOfDay, type Tour } from "@turvio/shared";
import { Button, Checkbox, Dialog, Input, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, cn, toast } from "@turvio/web-ui/ds";
import { Archive, ArchiveRestore, Ban, CheckCircle2, Copy, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Send, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { availableActions, lifecycleApi, reasonText, type DeleteEligibility } from "../lib/lifecycle";
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
  const [dialog, setDialog] = useState<Dialogs>(null);
  const t = item.tour;
  const a = availableActions(t, item.stopCount ?? 0);
  const role = session.role;
  const may = { manage: can(role, "tours.manage"), close: can(role, "tours.close"), archive: can(role, "tours.archive"), del: can(role, "tours.delete") };
  const items: ReactNode[] = [];
  if (onOpen) items.push(<MenuItem key="open" icon={<Eye />} onSelect={onOpen}>View details</MenuItem>);
  if (may.manage && a.edit) items.push(<MenuItem key="edit" icon={<Pencil />} onSelect={() => setDialog("edit")}>Edit tour…</MenuItem>);
  if (may.manage) items.push(<MenuItem key="dup" icon={<Copy />} onSelect={() => setDialog("duplicate")}>Duplicate…</MenuItem>);
  if (may.manage && a.publish) items.push(<MenuItem key="pub" icon={<Send />} onSelect={() => setDialog("publish")}>Publish to driver</MenuItem>);
  if (may.manage && a.withdraw) items.push(<MenuItem key="wd" icon={<EyeOff />} onSelect={() => setDialog("withdraw")}>Withdraw from driver</MenuItem>);
  const closing: ReactNode[] = [];
  if (may.close && a.finish) closing.push(<MenuItem key="fin" icon={<CheckCircle2 />} onSelect={() => setDialog("finish")}>Finish remotely…</MenuItem>);
  if (may.close && a.cancel) closing.push(<MenuItem key="can" icon={<Ban />} onSelect={() => setDialog("cancel")}>Cancel tour…</MenuItem>);
  const keeping: ReactNode[] = [];
  if (may.archive && a.archive) keeping.push(<MenuItem key="arc" icon={<Archive />} onSelect={() => setDialog("archive")}>Archive</MenuItem>);
  if (may.archive && a.restore) keeping.push(<MenuItem key="res" icon={<ArchiveRestore />} onSelect={() => setDialog("restore")}>Restore from archive</MenuItem>);
  if (may.del && a.delete)
    keeping.push(
      <MenuItem key="del" icon={<Trash2 />} className="text-danger-ink" onSelect={() => setDialog("delete")}>
        Delete permanently…
      </MenuItem>,
    );

  const close = () => setDialog(null);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`} onClick={(e) => e.stopPropagation()}>
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
          {items.length + closing.length + keeping.length === 0 && <MenuItem disabled>No actions for your role</MenuItem>}
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
  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        Cancel
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
      title={`Edit ${t.name}`}
      description={t.publishedAt ? "The tour is published: the driver's app shows the change at the next sync." : "Not published yet."}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          label="Save changes"
          disabled={!changed || startMinute === null || !name.trim()}
          onConfirm={async () => {
            if (await run(() => api.update(t, patch), `${t.name} saved`, "Not saved")) onClose();
          }}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Tour name" />
        </Field>
        <Field label="Date" hint={canMove ? undefined : "Only tours that have not started can be moved."}>
          <input type="date" className={fieldCls} value={date} disabled={!canMove} onChange={(e) => setDate(e.target.value)} aria-label="Tour date" />
        </Field>
        <Field label="Start time">
          <input type="time" className={cn(fieldCls, startMinute === null && "border-danger")} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start time" />
        </Field>
        <Field label="Location" hint={canMove ? undefined : "Only tours that have not started can change location."}>
          <select className={fieldCls} value={depot} disabled={!canMove} onChange={(e) => (setDepot(e.target.value), setDriver(""), setVehicle(""))} aria-label="Location">
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Driver">
          <select className={fieldCls} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label="Driver">
            <option value="">No driver</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vehicle" className="sm:col-span-2">
          <select className={fieldCls} value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Vehicle">
            <option value="">No vehicle</option>
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
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const [date, setDate] = useState(plusDays(t.date, 1));
  const [name, setName] = useState(`${t.name} (copy)`.slice(0, 120));
  const [includeStops, setIncludeStops] = useState(true);
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const { busy, run } = useAction(onChanged);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`Duplicate ${t.name}`}
      description="Creates a new, unpublished tour. Stops are copied as new open stops (address, time window, notes) – without parcels and without any history."
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          label="Create copy"
          disabled={!date || !name.trim()}
          onConfirm={async () => {
            let copied = 0;
            const ok = await run(
              async () => {
                copied = (await api.duplicate(t.id, { date, name: name.trim(), driverId: driver || null, vehicleId: vehicle || null, includeStops })).stops;
              },
              `Copy of ${t.name} created`,
              "Not duplicated",
            );
            if (ok) {
              if (includeStops) toast.message(`${copied} stop(s) copied to ${date}`);
              onClose();
            }
          }}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Name of the copy" />
        </Field>
        <Field label="Date">
          <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date of the copy" />
        </Field>
        <Field label="Driver" hint="Optional – checked against that day's tours.">
          <select className={fieldCls} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label="Driver of the copy">
            <option value="">Assign later</option>
            {scoped.drivers
              .filter((d) => d.active && d.depotId === t.depotId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Vehicle" className="sm:col-span-2">
          <select className={fieldCls} value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Vehicle of the copy">
            <option value="">Assign later</option>
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
          <Checkbox checked={includeStops} onCheckedChange={(c) => setIncludeStops(c === true)} label="Copy the stops" />
          Copy the stops{item.stopCount !== undefined ? ` (${item.stopCount}, cancelled ones excluded)` : " (cancelled ones excluded)"}
        </label>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- finish / cancel
export function CloseTourDialog({ item, mode, onClose, onChanged }: { item: ActionTour; mode: "finish" | "cancel"; onClose: () => void; onChanged?: () => void }) {
  const { session } = useDispatch();
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
      title={mode === "finish" ? `Finish ${t.name} remotely?` : `Cancel ${t.name}?`}
      description={
        mode === "finish"
          ? "The tour is marked completed now. Delivered and failed stops, photos, signatures and GPS history stay unchanged."
          : "The tour is stopped and marked cancelled. Everything already recorded stays unchanged."
      }
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          tone={mode === "cancel" ? "danger" : "primary"}
          label={mode === "finish" ? "Finish tour" : "Cancel tour"}
          disabled={!valid}
          onConfirm={async () => {
            let summary = "";
            const ok = await run(
              async () => {
                const r = await api.close(t, mode === "finish" ? "completed" : "cancelled", reason.trim(), openStops);
                summary =
                  r.openStops.action === "returned_to_pool"
                    ? `${r.openStops.count} open stop(s) back in the unassigned list`
                    : r.openStops.action === "cancelled"
                      ? `${r.openStops.count} open stop(s) cancelled`
                      : "No open stops";
              },
              mode === "finish" ? `${t.name} finished` : `${t.name} cancelled`,
              mode === "finish" ? "Not finished" : "Not cancelled",
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
            {item.driverName ?? "The driver"} is on this tour. Live tracking for it stops now; the driver&apos;s app shows the tour as {mode === "finish" ? "completed" : "removed"} at the next sync.
            Actions the phone recorded before now (offline) are still accepted, later ones are refused.
          </p>
        )}
        <Field label="Reason (recorded with your name and the time)">
          <textarea
            className={cn(fieldCls, "h-20 py-2")}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason"
            placeholder={mode === "finish" ? "e.g. shift ended, remaining stops go to tomorrow" : "e.g. vehicle breakdown"}
          />
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 font-medium">Open stops{item.openStops !== undefined ? ` (${item.openStops})` : ""}</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="openStops" checked={openStops === "return"} onChange={() => setOpenStops("return")} className="mt-1" />
            <span>
              <span className="font-medium text-ink">Return to the unassigned list</span> (recommended) – they can be planned on another tour.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="openStops" checked={openStops === "cancel"} onChange={() => setOpenStops("cancel")} className="mt-1" />
            <span>
              <span className="font-medium text-ink">Cancel them</span> with this reason – they stay on the tour as cancelled.
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
  const t = item.tour;
  const api = lifecycleApi(session.organizationId);
  const { busy, run } = useAction(onChanged);
  const text = {
    archive: {
      title: `Archive ${t.name}?`,
      body: "The tour is hidden from the daily views and the driver app. Nothing is deleted: stops, deliveries, proofs, GPS references and history stay and can be viewed and exported in the Archive.",
      label: "Archive",
      ok: `${t.name} archived`,
      fn: () => api.archive(t),
    },
    restore: {
      title: `Restore ${t.name}?`,
      body: `The tour returns to the normal views with its status unchanged (${t.status === "planned" ? "planned" : t.status}). A completed or cancelled tour is not reopened – use Duplicate to plan it again.`,
      label: "Restore",
      ok: `${t.name} restored`,
      fn: () => api.restore(t),
    },
    publish: {
      title: `Publish ${t.name}?`,
      body: `${item.driverName ?? "The driver"} will see this tour in TURVIO Driver. You can withdraw it again until the tour starts.`,
      label: "Publish",
      ok: `${t.name} published`,
      fn: () => api.publish(t),
    },
    withdraw: {
      title: `Withdraw ${t.name}?`,
      body: "The tour disappears from the driver's app until you publish it again. Nothing else changes.",
      label: "Withdraw",
      ok: `${t.name} withdrawn`,
      fn: () => api.withdraw(t),
    },
  }[action];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={text.title}
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          label={text.label}
          onConfirm={async () => {
            if (await run(text.fn, text.ok, `${text.label} failed`)) onClose();
          }}
        />
      }
    >
      <p className="text-[13px] text-ink-2">{text.body}</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- permanent delete
const RECORD_LABELS: [keyof DeleteEligibility, string][] = [
  ["processedStops", "stops with an outcome"],
  ["stopEvents", "stop history entries"],
  ["proofs", "proofs of delivery"],
  ["scannedParcels", "scanned parcels"],
  ["locationPoints", "GPS positions"],
];

export function DeleteTourDialog({ item, onClose, onChanged, onDeleted }: { item: ActionTour; onClose: () => void; onChanged?: () => void; onDeleted?: () => void }) {
  const { session } = useDispatch();
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
  const protectedRecords = e ? RECORD_LABELS.filter(([k]) => (e[k] as number) > 0) : [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={`Delete ${t.name} permanently?`}
      description="Only tours without any protected history can be deleted. Everything else can be archived instead (nothing is lost)."
      footer={
        <Footer
          busy={busy}
          onCancel={onClose}
          tone="danger"
          label="Delete permanently"
          disabled={!e?.eligible}
          onConfirm={async () => {
            if (await run(() => api.remove({ id: t.id, version: e!.tour.version }, deleteStops), `${t.name} deleted`, "Not deleted")) {
              onClose();
              onDeleted?.();
            }
          }}
        />
      }
    >
      {!e && !loadError && (
        <p className="flex items-center gap-2 text-[13px] text-muted" aria-busy="true">
          <Loader2 className="size-4 animate-spin" /> Checking what this tour holds…
        </p>
      )}
      {loadError && <p className="text-[13px] text-danger-ink">{loadError}</p>}
      {e && (
        <div className="flex flex-col gap-3 text-[13px] text-ink-2" data-testid="delete-preview">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Tour</dt>
            <dd className="font-semibold text-ink">{e.tour.name}</dd>
            <dt className="text-muted">Date</dt>
            <dd>{e.tour.date}</dd>
            <dt className="text-muted">Driver</dt>
            <dd>{e.tour.driverName ?? "–"}</dd>
            <dt className="text-muted">Stops</dt>
            <dd className="tabular">{e.stops}</dd>
            <dt className="text-muted">Completed deliveries</dt>
            <dd className="tabular">{e.completedDeliveries}</dd>
          </dl>
          {e.eligible ? (
            <>
              <p className="rounded-md bg-success-soft px-3 py-2 text-success-ink">Eligible: no deliveries, proofs, scans, GPS or execution history.</p>
              {e.stops > 0 && (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 font-medium">Its {e.stops} unprocessed stop(s)</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="deleteStops" checked={!deleteStops} onChange={() => setDeleteStops(false)} />
                    Return them to the unassigned list (recommended)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="deleteStops" checked={deleteStops} onChange={() => setDeleteStops(true)} />
                    Delete them as well (test / draft stops)
                  </label>
                </fieldset>
              )}
              <p className="text-2xs text-muted">The deletion is recorded (who, when, tour name, date, driver, stop count).</p>
            </>
          ) : (
            <div className="flex flex-col gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger-ink" role="alert">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="size-4" /> Protected – cannot be deleted
              </p>
              <ul className="list-disc ps-5">
                {e.reasons.map((r) => (
                  <li key={r}>This tour {reasonText(r)}.</li>
                ))}
              </ul>
              {protectedRecords.length > 0 && (
                <p>
                  Protected records:{" "}
                  {protectedRecords.map(([k, label]) => `${e[k] as number} ${label}`).join(" · ")}
                </p>
              )}
              <p className="text-ink-2">Archive the tour to hide it – everything stays available.</p>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
