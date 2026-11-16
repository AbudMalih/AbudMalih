"use client";

import { isOpen, type Stop, type TourSummary } from "@turvio/shared";
import { Button, Dialog, Input, toast } from "@turvio/web-ui/ds";
import { ArrowDown, ArrowUp, Ban, CornerUpLeft, MapPinned, MoveRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { lifecycleApi } from "../lib/lifecycle";
import { useT } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { gField } from "./TourActions";

/**
 * Dispatcher edits on an open stop: address, order, move to another tour, and three different
 * ways to take it off the tour – Remove (back to the unassigned list), Cancel (kept as a record
 * with a reason) and Delete (only draft / test stops without any history; the server decides).
 */
export function StopEditActions({ summary, stop }: { summary: TourSummary; stop: Stop }) {
  const { editStopAddress, reorderStops, assignStops, deleteStop, summaries, session, reload } = useDispatch();
  const tr = useT();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [form, setForm] = useState({ recipientName: stop.recipientName ?? "", street: stop.address.street, houseNumber: stop.address.houseNumber ?? "", postalCode: stop.address.postalCode, city: stop.address.city });
  const [reason, setReason] = useState("");
  // After publication every address change needs a reason (it is recorded with the change).
  const published = !!summary.tour.publishedAt;
  const addressChanged =
    form.street !== stop.address.street || form.houseNumber !== (stop.address.houseNumber ?? "") || form.postalCode !== stop.address.postalCode || form.city !== stop.address.city;
  const open = summary.stops.filter((s) => isOpen(s.status)).sort((a, b) => a.sequence - b.sequence);
  const idx = open.findIndex((s) => s.id === stop.id);
  const targets = summaries.filter((s) => s.tour.id !== summary.tour.id && s.depot.id === summary.depot.id && s.tour.status !== "completed");

  const attempt = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
    } catch (e) {
      toast.error(tr("tours.a.notSaved"), { description: errorMessage(e) });
    }
  };
  const move = (delta: number) => {
    const ids = open.map((s) => s.id);
    const [m] = ids.splice(idx, 1);
    ids.splice(idx + delta, 0, m!);
    return attempt(tr("tours.se.orderSaved"), () => reorderStops(summary.tour.id, ids));
  };

  if (!isOpen(stop.status)) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="stop-edit-actions">
      <Button size="sm" variant="secondary" disabled={idx <= 0} onClick={() => void move(-1)} aria-label={tr("tours.se.moveUp")}>
        <ArrowUp />
      </Button>
      <Button size="sm" variant="secondary" disabled={idx < 0 || idx >= open.length - 1} onClick={() => void move(1)} aria-label={tr("tours.se.moveDown")}>
        <ArrowDown />
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        <Pencil /> {tr("tours.se.editAddress")}
      </Button>
      {targets.length > 0 && (
        <Button size="sm" variant="secondary" onClick={() => setMoving(true)}>
          <MoveRight className="rtl:-scale-x-100" /> {tr("tours.se.moveToTour")}
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => setRemoving(true)}>
        <CornerUpLeft className="rtl:-scale-x-100" /> {tr("common.remove")}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setCancelling(true)}>
        <Ban /> {tr("tours.se.cancelStop")}
      </Button>
      <Button size="sm" variant="ghost" className="text-danger-ink" onClick={() => setDeleting(true)}>
        <Trash2 /> {tr("common.delete")}
      </Button>

      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title={tr("tours.se.editAddress")}
        description={tr("tours.se.editDesc")}
        footer={
          <Button
            onClick={async () => {
              await attempt(tr("tours.se.addressSaved"), () =>
                editStopAddress(stop.id, { street: form.street, houseNumber: form.houseNumber || null, postalCode: form.postalCode, city: form.city }, form.recipientName || null, {
                  reason: reason.trim() || undefined,
                  expectedAddressVersion: stop.addressVersion,
                }),
              );
              setEditing(false);
              setReason("");
            }}
            disabled={!form.street || !form.postalCode || !form.city || (published && addressChanged && !reason.trim())}
          >
            <MapPinned /> {tr("common.save")}
          </Button>
        }
      >
        <div className="grid grid-cols-6 gap-2 text-[13px] g:gap-x-2 g:gap-y-3">
          {(
            [
              ["recipientName", tr("tours.se.recipient"), "col-span-6"],
              ["street", tr("tours.se.street"), "col-span-4"],
              ["houseNumber", tr("tours.se.houseNumber"), "col-span-2"],
              ["postalCode", tr("tours.se.postalCode"), "col-span-2"],
              ["city", tr("tours.se.city"), "col-span-4"],
            ] as const
          ).map(([k, label, cls]) => (
            <label key={k} className={`flex flex-col gap-1 ${cls}`}>
              <span className="font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted">{label}</span>
              <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-label={label} dir={k === "postalCode" ? "ltr" : undefined} />
            </label>
          ))}
          {addressChanged && (
            <label className="col-span-6 flex flex-col gap-1">
              <span className="font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted">{published ? tr("tours.se.reasonRequired") : tr("tours.se.reasonOptional")}</span>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label={tr("tours.se.reasonChangeAria")} maxLength={500} />
            </label>
          )}
        </div>
      </Dialog>

      <Dialog open={moving} onOpenChange={setMoving} title={tr("tours.se.moveTitle")} description={tr("tours.se.moveDesc")}>
        <div className="flex flex-col gap-1.5 g:gap-0 g:divide-y g:divide-line g:overflow-hidden g:rounded-md g:border g:border-line">
          {targets.map((t) => (
            <Button
              key={t.tour.id}
              variant="secondary"
              className="justify-start g:h-9 g:rounded-none g:border-0 g:bg-transparent g:font-normal g:hover:bg-[var(--hover)]"
              onClick={async () => {
                await attempt(tr("tours.se.movedTo", { name: t.tour.name }), () => assignStops([stop.id], t.tour.id));
                setMoving(false);
              }}
            >
              {tr("tours.se.moveRow", { name: t.tour.name, driver: t.driver?.displayName ?? tr("tours.se.noDriver"), count: t.remaining })}
            </Button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={tr("tours.se.removeTitle")}
        description={tr(summary.tour.publishedAt ? "tours.se.removeDescPublished" : "tours.se.removeDesc", { name: stop.recipientName ?? stop.address.street, depot: summary.depot.name })}
        confirmLabel={tr("tours.se.removeConfirm")}
        onConfirm={async () => {
          try {
            await assignStops([stop.id], null);
            toast.success(tr("tours.se.removed"));
          } catch (e) {
            toast.error(tr("tours.se.notRemoved"), { description: errorMessage(e) });
            throw e;
          }
        }}
      />

      <Dialog
        open={cancelling}
        onOpenChange={(o) => (setCancelling(o), o || setCancelReason(""))}
        title={tr("tours.se.cancelTitle")}
        description={tr("tours.se.cancelDesc")}
        footer={
          <Button
            variant="danger"
            disabled={cancelReason.trim().length < 3}
            onClick={async () => {
              try {
                await lifecycleApi(session.organizationId).cancelStop(stop.id, cancelReason.trim());
                toast.success(tr("tours.se.cancelled"));
                setCancelling(false);
                setCancelReason("");
              } catch (e) {
                toast.error(tr("tours.se.notCancelled"), { description: errorMessage(e) });
              } finally {
                void reload().catch(() => undefined);
              }
            }}
          >
            <Ban /> {tr("tours.se.cancelStop")}
          </Button>
        }
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted">
          {tr("tours.se.reason")}
          <textarea className={`${fieldCls} h-20 py-2 ${gField} g:text-ink`} value={cancelReason} maxLength={500} onChange={(e) => setCancelReason(e.target.value)} aria-label={tr("tours.se.cancelReasonAria")} />
        </label>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={tr("tours.se.deleteTitle")}
        description={tr("tours.se.deleteDesc", { name: stop.recipientName ?? stop.address.street, count: stop.parcels.length })}
        confirmLabel={tr("tours.se.deleteConfirm")}
        tone="danger"
        onConfirm={async () => {
          try {
            await deleteStop(stop.id);
            toast.success(tr("tours.se.deleted"));
          } catch (e) {
            toast.error(tr("tours.se.notDeleted"), { description: errorMessage(e) });
            throw e;
          }
        }}
      />
    </div>
  );
}
