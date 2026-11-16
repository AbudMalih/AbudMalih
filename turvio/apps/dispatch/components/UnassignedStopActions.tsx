"use client";

import { Button, Dialog, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, toast } from "@turvio/web-ui/ds";
import { Ban, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { api as call, errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { lifecycleApi } from "../lib/lifecycle";
import { useDispatch } from "../lib/store";

/**
 * Selected unassigned stops: cancel (kept as a record with a reason) or delete (only draft /
 * test stops without history – the server refuses the others, which are then reported).
 */
export function UnassignedStopActions({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { session, reload } = useDispatch();
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
    if (ok) toast.success(`${ok} stop(s) ${dialog === "cancel" ? "cancelled" : "deleted"}`);
    if (failed.length) toast.error(`${failed.length} stop(s) unchanged`, { description: [...new Set(failed)].join(" · ") });
    setDialog(null);
    setReason("");
    onDone();
    void reload().catch(() => undefined);
  };
  return (
    <>
      <Menu>
        <MenuTrigger asChild disabled={ids.length === 0}>
          <Button size="icon-sm" variant="secondary" aria-label="More actions for the selected stops">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" className="w-60">
          <MenuLabel>{ids.length} selected stop(s)</MenuLabel>
          <MenuItem icon={<Ban />} onSelect={() => setDialog("cancel")}>
            Cancel with a reason…
          </MenuItem>
          <MenuItem icon={<Trash2 />} className="text-danger-ink" onSelect={() => setDialog("delete")}>
            Delete draft stops…
          </MenuItem>
        </MenuContent>
      </Menu>
      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => !o && !busy && setDialog(null)}
        title={dialog === "cancel" ? `Cancel ${ids.length} stop(s)?` : `Delete ${ids.length} stop(s) permanently?`}
        description={
          dialog === "cancel"
            ? "Cancelled stops are kept as records with the reason, your name and the time. They are not planned or delivered."
            : "Only draft or test stops without any history are deleted. Stops with history stay unchanged and are reported – cancel those instead."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Back
            </Button>
            <Button variant="danger" onClick={() => void run()} disabled={busy || (dialog === "cancel" && reason.trim().length < 3)}>
              {busy && <Loader2 className="animate-spin" />}
              {dialog === "cancel" ? "Cancel stops" : "Delete stops"}
            </Button>
          </>
        }
      >
        {dialog === "cancel" && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Reason
            <textarea className={`${fieldCls} h-20 py-2`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-label="Reason for cancelling the stops" />
          </label>
        )}
      </Dialog>
    </>
  );
}

