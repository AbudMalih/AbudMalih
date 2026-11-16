"use client";

import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { lifecycleApi, reasonText, type BulkAction, type BulkPreview, type BulkResult, type BulkSelection } from "../lib/lifecycle";
import type { MessageKey } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";

/** Which bulk actions are destructive; texts are `tours.bulk.<action>.*`. */
export const BULK_LABEL: Record<BulkAction, { danger?: boolean }> = {
  archive: {},
  restore: {},
  delete: { danger: true },
  finish: {},
  cancel: { danger: true },
  withdraw: {},
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
  const { t, locale } = useI18n();
  const meta = BULK_LABEL[action];
  const k = (part: "title" | "explain" | "run" | "pending" | "done" | "result") => `tours.bulk.${action}.${part}` as MessageKey;
  const title = t(k("title"));
  const reasonList = (codes: string[]) => codes.map((c) => reasonText(c, t)).join(locale === "ar" ? "، " : ", ");
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
      if (r.done) toast.success(t(k("done"), { count: r.done }));
      if (r.failed || r.skipped) toast.message(t("tours.bulk.unchangedToast", { count: r.skipped + r.failed }));
      onDone();
      void reload().catch(() => undefined);
    } catch (e) {
      toast.error(t("tours.bulk.failed", { title }), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const s = preview?.summary;
  const blocked = preview?.tours.filter((row) => !row.eligible && !row.unchanged) ?? [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={title}
      description={t(k("explain"))}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            {t("tours.bulk.done")}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={meta.danger ? "danger" : "primary"}
              onClick={() => void runIt()}
              disabled={busy || !s || s.eligible === 0 || (needsReason && reason.trim().length < 3)}
            >
              {busy && <Loader2 className="animate-spin" />}
              {s ? t(k("run"), { count: s.eligible }) : t(k("pending"))}
            </Button>
          </>
        )
      }
    >
      {!preview && !error && (
        <p className="flex items-center gap-2 text-[13px] text-muted" aria-busy="true">
          <Loader2 className="size-4 animate-spin" /> {t("tours.bulk.counting")}
        </p>
      )}
      {error && <p className="text-[13px] text-danger-ink">{error}</p>}
      {s && !result && (
        <div className="flex flex-col gap-3 text-[13px] text-ink-2" data-testid="bulk-preview">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                [t("tours.bulk.selected"), s.selected],
                [t("tours.bulk.willChange"), s.eligible],
                [action === "delete" ? t("tours.bulk.protected") : t("tours.bulk.notPossible"), s.protected],
                [t("tours.bulk.alreadyDone"), s.unchanged],
                [action === "finish" || action === "cancel" ? t("tours.bulk.openAffected") : t("tours.bulk.stopsOn"), s.affectedStops],
                [t("tours.del.completedDeliveries"), s.completedDeliveries],
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
                {t("tours.bulk.stayUnchanged", { count: blocked.length })}
              </summary>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto ps-5">
                {blocked.map((row) => (
                  <li key={row.id}>
                    {t(row.date ? "tours.bulk.blockedRow" : "tours.bulk.blockedRowNoDate", { name: row.name || t("tours.bulk.unknownTour"), date: row.date, reasons: reasonList(row.reasons) })}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {needsReason && (
            <>
              <label className="flex flex-col gap-1.5 font-medium">
                {t("tours.bulk.reasonLabel")}
                <textarea className={cn(fieldCls, "h-16 py-2")} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-label={t("tours.close.reason")} />
              </label>
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 font-medium">{t("tours.close.openStops")}</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="bulkOpenStops" checked={openStops === "return"} onChange={() => setOpenStops("return")} /> {t("tours.bulk.returnOpt")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="bulkOpenStops" checked={openStops === "cancel"} onChange={() => setOpenStops("cancel")} /> {t("tours.bulk.cancelOpt")}
                </label>
              </fieldset>
            </>
          )}
          {action === "delete" && s.affectedStops > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-medium">{t("tours.bulk.unprocessed", { count: s.affectedStops })}</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulkDeleteStops" checked={!deleteStops} onChange={() => setDeleteStops(false)} /> {t("tours.bulk.returnOpt")}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulkDeleteStops" checked={deleteStops} onChange={() => setDeleteStops(true)} /> {t("tours.bulk.deleteAlso")}
              </label>
            </fieldset>
          )}
        </div>
      )}
      {result && (
        <div className="flex flex-col gap-2 text-[13px] text-ink-2" data-testid="bulk-result">
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <CheckCircle2 className="size-4 text-success-ink" />
            {t(k("result"), { done: result.done, unchanged: result.unchanged, skipped: result.skipped, failed: result.failed })}
          </p>
          {result.results.filter((r) => r.result === "failed" || r.result === "skipped").length > 0 && (
            <ul className="max-h-48 list-disc overflow-y-auto ps-5">
              {result.results
                .filter((r) => r.result === "failed" || r.result === "skipped")
                .map((r) => (
                  <li key={r.id}>
                    {r.name || r.id}: {r.code ? reasonText(r.code, t) : r.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}
