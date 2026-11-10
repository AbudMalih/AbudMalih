"use client";

import { isOpen, type Stop, type TourSummary } from "@turvio/shared";
import { Button, Dialog, Input, toast } from "@turvio/web-ui/ds";
import { ArrowDown, ArrowUp, MapPinned, MoveRight, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../lib/api";
import { useDispatch } from "../lib/store";
import { ConfirmDialog } from "./ConfirmDialog";

/** Dispatcher edits on an open stop: address, order, move to another tour, delete. */
export function StopEditActions({ summary, stop }: { summary: TourSummary; stop: Stop }) {
  const { editStopAddress, reorderStops, assignStops, deleteStop, summaries } = useDispatch();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      toast.error("Not saved", { description: errorMessage(e) });
    }
  };
  const move = (delta: number) => {
    const ids = open.map((s) => s.id);
    const [m] = ids.splice(idx, 1);
    ids.splice(idx + delta, 0, m!);
    return attempt("Order saved", () => reorderStops(summary.tour.id, ids));
  };

  if (!isOpen(stop.status)) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="stop-edit-actions">
      <Button size="sm" variant="secondary" disabled={idx <= 0} onClick={() => void move(-1)} aria-label="Move up">
        <ArrowUp />
      </Button>
      <Button size="sm" variant="secondary" disabled={idx < 0 || idx >= open.length - 1} onClick={() => void move(1)} aria-label="Move down">
        <ArrowDown />
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        <Pencil /> Edit address
      </Button>
      {targets.length > 0 && (
        <Button size="sm" variant="secondary" onClick={() => setMoving(true)}>
          <MoveRight /> Move to tour
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => setDeleting(true)}>
        <Trash2 /> Delete
      </Button>

      <Dialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit address"
        description="If the address changes, the old map position is removed until a new one is set. The original address stays in the history."
        footer={
          <Button
            onClick={async () => {
              await attempt("Address saved", () =>
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
            <MapPinned /> Save
          </Button>
        }
      >
        <div className="grid grid-cols-6 gap-2 text-[13px]">
          {(
            [
              ["recipientName", "Recipient", "col-span-6"],
              ["street", "Street", "col-span-4"],
              ["houseNumber", "No.", "col-span-2"],
              ["postalCode", "Postal code", "col-span-2"],
              ["city", "City", "col-span-4"],
            ] as const
          ).map(([k, label, cls]) => (
            <label key={k} className={`flex flex-col gap-1 ${cls}`}>
              <span className="font-medium text-ink-2">{label}</span>
              <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-label={label} />
            </label>
          ))}
          {addressChanged && (
            <label className="col-span-6 flex flex-col gap-1">
              <span className="font-medium text-ink-2">Reason{published ? " (required – the tour is published)" : " (optional)"}</span>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for the change" maxLength={500} />
            </label>
          )}
        </div>
      </Dialog>

      <Dialog open={moving} onOpenChange={setMoving} title="Move stop to another tour" description="Only open tours of the same depot. The driver's app follows on the next sync.">
        <div className="flex flex-col gap-1.5">
          {targets.map((t) => (
            <Button
              key={t.tour.id}
              variant="secondary"
              className="justify-start"
              onClick={async () => {
                await attempt(`Moved to ${t.tour.name}`, () => assignStops([stop.id], t.tour.id));
                setMoving(false);
              }}
            >
              {t.tour.name} · {t.driver?.displayName ?? "no driver"} · {t.remaining} open
            </Button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete stop?"
        description={`${stop.recipientName ?? stop.address.street} and its ${stop.parcels.length} parcel(s) are removed from ${summary.tour.name}.`}
        confirmLabel="Delete stop"
        tone="danger"
        onConfirm={() => deleteStop(stop.id)}
      />
    </div>
  );
}
