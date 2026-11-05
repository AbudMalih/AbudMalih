"use client";

import { Button, Dialog } from "@turvio/web-ui/ds";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Confirmation for destructive or outward-facing actions (delete, publish). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* the caller shows the error */
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13px] text-ink-2">{description}</div>
    </Dialog>
  );
}
