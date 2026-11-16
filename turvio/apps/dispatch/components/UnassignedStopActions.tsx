"use client";

import { Button, Dialog, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, toast } from "@turvio/web-ui/ds";
import { Ban, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { api as call, errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { lifecycleApi } from "../lib/lifecycle";
import { useT } from "../lib/i18n/client";
import { useDispatch } from "../lib/store";
import { gField } from "./TourActions";

/**
 * Selected unassigned stops: cancel (kept as a record with a reason) or delete (only draft /
 * test stops without history – the server refuses the others, which are then reported).
 */
export function UnassignedStopActions({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { session, reload } = useDispatch();
  const t = useT();
  const [dialog, setDialog] = useState<null | "cancel" | "delete">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const api = lifecycleApi(session.organizationId);
  const run = async () => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        if (dialog === "cancel") await api.cancelStop(id, reason.trim());
        else await call<void>("DELETE", `/v1/orgs/${session.organizationId}/stops/${id}`);
        ok++;
      } catch (e) {
        failed.push(errorMessage(e));
      }
    }
    setBusy(false);
    if (ok) toast.success(t(dialog === "cancel" ? "tours.un.cancelledToast" : "tours.un.deletedToast", { count: ok }));
    if (failed.length) toast.error(t("tours.un.unchangedToast", { count: failed.length }), { description: [...new Set(failed)].join(" · ") });
    setDialog(null);
    setReason("");
    onDone();
    void reload().catch(() => undefined);
  };
  return (
    <>
      <Menu>
        <MenuTrigger asChild disabled={ids.length === 0}>
          <Button size="icon-sm" variant="secondary" aria-label={t("tours.un.moreAria")}>
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" className="w-60">
          <MenuLabel>{t("tours.un.selected", { count: ids.length })}</MenuLabel>
          <MenuItem icon={<Ban />} onSelect={() => setDialog("cancel")}>
            {t("tours.un.cancelWithReason")}
          </MenuItem>
          <MenuItem icon={<Trash2 />} className="text-danger-ink" onSelect={() => setDialog("delete")}>
            {t("tours.un.deleteDrafts")}
          </MenuItem>
        </MenuContent>
      </Menu>
      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => !o && !busy && setDialog(null)}
        title={t(dialog === "cancel" ? "tours.un.titleCancel" : "tours.un.titleDelete", { count: ids.length })}
        description={dialog === "cancel" ? t("tours.un.descCancel") : t("tours.un.descDelete")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              {t("common.back")}
            </Button>
            <Button variant="danger" onClick={() => void run()} disabled={busy || (dialog === "cancel" && reason.trim().length < 3)}>
              {busy && <Loader2 className="animate-spin" />}
              {dialog === "cancel" ? t("tours.un.cancelStops") : t("tours.un.deleteStops")}
            </Button>
          </>
        }
      >
        {dialog === "cancel" && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted">
            {t("tours.un.reason")}
            <textarea className={`${fieldCls} h-20 py-2 ${gField} g:text-ink`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-label={t("tours.un.reasonAria")} />
          </label>
        )}
      </Dialog>
    </>
  );
}

