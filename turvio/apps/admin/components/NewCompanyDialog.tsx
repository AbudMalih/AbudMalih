"use client";

import { PLAN_CATALOGUE } from "@turvio/shared";
import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputCls = "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none";
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/\b(gmbh|ag|kg|ug|llc|srl|ltd)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** Onboard a company: organization + trial subscription + owner invitation (real API call). */
export function NewCompanyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState("team");
  const [seats, setSeats] = useState("5");
  const [owner, setOwner] = useState("");
  const [country, setCountry] = useState("DE");
  const valid = name.trim().length >= 2 && /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner) && Number(seats) >= 1;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/turvio/v1/platform/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug, countryCode: country, planCode: plan, seats: Number(seats), ownerEmail: owner.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      toast.success(`${data.name} created`, { description: `Trial started · invitation sent to ${data.ownerInvited}` });
      setOpen(false);
      setName("");
      setSlug("");
      setSlugTouched(false);
      setOwner("");
      router.refresh();
    } catch (e) {
      toast.error("Company not created", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus /> New company
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="Onboard a company"
        description="Creates the company with a trial subscription and emails an owner invitation. No payment is taken."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy || !valid}>
              {busy && <Loader2 className="animate-spin" />} Create & invite owner
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 sm:col-span-2">
            Company name
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
            Slug
            <input
              className={cn(inputCls, slug && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) && "border-danger")}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
            Country
            <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
              {["DE", "AT", "CH", "NL", "RO", "AE"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
            Plan
            <select className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLAN_CATALOGUE.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.trialDays}-day trial)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
            Driver seats
            <input className={inputCls} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 sm:col-span-2">
            Owner email
            <input className={inputCls} type="email" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
        </div>
      </Dialog>
    </>
  );
}
