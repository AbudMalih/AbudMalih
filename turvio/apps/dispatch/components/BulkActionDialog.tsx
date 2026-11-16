"use client";

import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { lifecycleApi, reasonText, type BulkAction, type BulkPreview, type BulkResult, type BulkSelection } from "../lib/lifecycle";
import { useDispatch } from "../lib/store";

export const BULK_LABEL: Record<BulkAction, { title: string; verb: string; done: string; danger?: boolean; explain: string }> = {
  archive: { title: "Archive tours", verb: "Archive", done: "archived", explain: "Archived tours are hidden from the daily views and the driver app. Nothing is deleted." },
  restore: { title: "Restore tours", verb: "Restore", done: "restored", explain: "Restored tours return to the normal views with their status unchanged – nothing is reopened." },
  delete: {
    title: "Delete tours permanently",
    verb: "Delete",
    done: "deleted",
    danger: true,
    explain: "Only tours without protected history (deliveries, proofs, scans, GPS, execution) are deleted. Protected tours stay unchanged.",
  },
  finish: { title: "Finish tours remotely", verb: "Finish", done: "finished", explain: "Running tours are marked completed now. Recorded deliveries and proofs stay unchanged." },
  cancel: { title: "Cancel tours", verb: "Cancel tours", done: "cancelled", danger: true, explain: "Tours are marked cancelled. Recorded deliveries and proofs stay unchanged." },
  withdraw: { title: "Withdraw tours from drivers", verb: "Withdraw", done: "withdrawn", explain: "Published tours that have not started disappear from the driver app." },
};

/**
 * Preview first (the server counts exactly what would change), then run. Every tour is handled on
 * its own: one refusal never undoes the others; the result lists each refusal.
 */
export function BulkActionDialog({
  action,
  selection,
  versions,
  onClose,
  onDone,
}: {
  action: BulkAction;
  selection: BulkSelection;
  versions?: Record<string, number>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { session, reload } = useDispatch();
  const api = lifecycleApi(session.organizationId);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [reason, setReason] = useState("");
  const [openStops, setOpenStops] = useState<"return" | "cancel">("return");
  const [deleteStops, setDeleteStops] = useState(false);
  const meta = BULK_LABEL[action];
  const needsReason = action === "finish" || action === "cancel";

  useEffect(() => {
    let alive = true;
    api.bulkPreview(action, selection).then(
      (p) => alive && setPreview(p),
      (e) => alive && setError(errorMessage(e)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runIt = async () => {
    setBusy(true);
    try {
      const r = await api.bulkRun({
        action,
        selection,
        versions,
        ...(needsReason ? { reason: reason.trim(), openStops } : {}),
        ...(action === "delete" ? { deleteStops } : {}),
      });
      setResult(r);
      if (r.done) toast.success(`${r.done} tour(s) ${meta.done}`);
      if (r.failed || r.skipped) toast.message(`${r.skipped + r.failed} tour(s) unchanged – see the details`);
      onDone();
      void reload().catch(() => undefined);
    } catch (e) {
      toast.error(`${meta.title} failed`, { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const s = preview?.summary;
  const blocked = preview?.tours.filter((t) => !t.eligible && !t.unchanged) ?? [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={meta.title}
      description={meta.explain}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={meta.danger ? "danger" : "primary"}
              onClick={() => void runIt()}
              disabled={busy || !s || s.eligible === 0 || (needsReason && reason.trim().length < 3)}
            >
              {busy && <Loader2 className="animate-spin" />}
              {meta.verb} {s ? s.eligible : ""} tour(s)
            </Button>
          </>
        )
      }
    >
      {!preview && !error && (
        <p className="flex items-center gap-2 text-[13px] text-muted" aria-busy="true">
          <Loader2 className="size-4 animate-spin" /> Counting what would change…
        </p>
      )}
      {error && <p className="text-[13px] text-danger-ink">{error}</p>}
      {s && !result && (
        <div className="flex flex-col gap-3 text-[13px] text-ink-2" data-testid="bulk-preview">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Selected", s.selected],
                ["Will change", s.eligible],
                [action === "delete" ? "Protected" : "Not possible", s.protected],
                ["Already done", s.unchanged],
                [action === "finish" || action === "cancel" ? "Open stops affected" : "Stops on them", s.affectedStops],
                ["Completed deliveries", s.completedDeliveries],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                <dd className="text-lg font-extrabold text-ink tabular">{n}</dd>
                <dt className="text-2xs text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          {blocked.length > 0 && (
            <details className="rounded-md bg-warning-soft px-3 py-2 text-warning-ink">
              <summary className="cursor-pointer font-semibold">
                <ShieldAlert className="me-1 inline size-4" />
                {blocked.length} tour(s) stay unchanged
              </summary>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto ps-5">
                {blocked.map((t) => (
                  <li key={t.id}>
                    {t.name || "Unknown tour"} {t.date && `(${t.date})`} – {t.reasons.map(reasonText).join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {needsReason && (
            <>
              <label className="flex flex-col gap-1.5 font-medium">
                Reason (recorded for each tour)
                <textarea className={cn(fieldCls, "h-16 py-2")} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 font-medium">Open stops</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="bulkOpenStops" checked={openStops === "return"} onChange={() => setOpenStops("return")} /> Return to the unassigned list (recommended)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="bulkOpenStops" checked={openStops === "cancel"} onChange={() => setOpenStops("cancel")} /> Cancel them with this reason
                </label>
              </fieldset>
            </>
          )}
          {action === "delete" && s.affectedStops > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-medium">Their {s.affectedStops} unprocessed stop(s)</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulkDeleteStops" checked={!deleteStops} onChange={() => setDeleteStops(false)} /> Return to the unassigned list (recommended)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulkDeleteStops" checked={deleteStops} onChange={() => setDeleteStops(true)} /> Delete them as well
              </label>
            </fieldset>
          )}
        </div>
      )}
      {result && (
        <div className="flex flex-col gap-2 text-[13px] text-ink-2" data-testid="bulk-result">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <CheckCircle2 className="size-4 text-success-ink" />
            {result.done} {meta.done} · {result.unchanged} already done · {result.skipped} not possible · {result.failed} failed
          </p>
          {result.results.filter((r) => r.result === "failed" || r.result === "skipped").length > 0 && (
            <ul className="max-h-48 list-disc overflow-y-auto ps-5">
              {result.results
                .filter((r) => r.result === "failed" || r.result === "skipped")
                .map((r) => (
                  <li key={r.id}>
                    {r.name || r.id}: {r.code ? reasonText(r.code) : r.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
