"use client";

import type { Stop } from "@turvio/shared";
import { Button, Dialog, toast } from "@turvio/web-ui/ds";
import { Camera, PenLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useDispatch } from "../lib/store";

/**
 * Proof-of-delivery records of a stop. Files are fetched through the
 * authenticated same-origin proxy; the API checks access (RLS) for every file.
 */
export function ProofList({ stop }: { stop: Stop }) {
  const { session, reload } = useDispatch();
  const [open, setOpen] = useState<string | null>(null);
  const canDelete = session.role === "owner" || session.role === "admin";
  const proofs = stop.proofs ?? [];
  const current = proofs.find((p) => p.id === open);
  const url = (id: string) => `/api/turvio/v1/orgs/${session.organizationId}/proofs/${id}/file`;
  return (
    <div className="flex flex-col gap-1.5" data-testid="proofs">
      <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-subtle">Proof of delivery</span>
      <div className="flex flex-wrap gap-1.5">
        {proofs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-2 hover:bg-surface-2"
            data-testid={`proof-${p.kind}`}
          >
            {p.kind === "photo" ? <Camera className="size-3.5" /> : <PenLine className="size-3.5" />}
            {p.kind === "photo" ? "Photo" : "Signature"}
            {p.recipientName ? ` · ${p.recipientName}` : ""} · {new Date(p.capturedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
          </button>
        ))}
      </div>
      <Dialog
        open={!!current}
        onOpenChange={(v) => !v && setOpen(null)}
        title={current?.kind === "photo" ? "Delivery photo" : "Signature"}
        description={`${stop.recipientName ?? ""} · captured ${current ? new Date(current.capturedAt).toLocaleString("de-DE") : ""}${current?.hasLocation ? " · with position" : ""}`}
      >
        {current && (
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url(current.id)} alt={current.kind === "photo" ? "Delivery photo" : "Recipient signature"} className="max-h-[60vh] w-full rounded-md border border-line bg-white object-contain" data-testid="proof-image" />
            {current.notes && <p className="text-xs text-muted">{current.notes}</p>}
            <p className="text-2xs text-subtle">Personal data – visible only to your company. Retention follows the company setting.</p>
            {canDelete && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!window.confirm("Delete this proof of delivery permanently?")) return;
                  try {
                    await api("DELETE", `/v1/orgs/${session.organizationId}/proofs/${current.id}`);
                    setOpen(null);
                    toast.success("Proof deleted");
                    await reload();
                  } catch (e) {
                    toast.error("Could not delete", { description: errorMessage(e) });
                  }
                }}
              >
                <Trash2 /> Delete proof
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
