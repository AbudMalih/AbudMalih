"use client";

import { PLAN_CATALOGUE } from "@turvio/shared";
import { Button, Dialog, cn, toast } from "@turvio/web-ui/ds";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, errorText } from "../lib/api";
import { useI18n } from "../lib/i18n/client";

const inputCls = "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none g:h-8 g:rounded-md g:border-line-2 g:bg-surface-2 g:text-[13px] g:text-ink g:shadow-none";
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
export function NewCompanyDialog({ onCreated }: { onCreated?: (id: string) => void }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [plan, setPlan] = useState("team");
  const [seats, setSeats] = useState("5");
  const [owner, setOwner] = useState("");
  const [country, setCountry] = useState("DE");
  const regions = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "region" }) : null;
  const countryName = (c: string) => regions?.of(c) ?? c;
  const valid = name.trim().length >= 2 && /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner) && Number(seats) >= 1;

  const submit = async () => {
    setBusy(true);
    try {
      const data = await api<{ id: string; name: string; ownerInvited: string }>("POST", "/v1/platform/organizations", {
        name: name.trim(),
        slug,
        countryCode: country,
        planCode: plan,
        seats: Number(seats),
        ownerEmail: owner.trim(),
      });
      toast.success(t("companies.new.created", { name: data.name }), { description: t("companies.new.createdDetail", { email: data.ownerInvited }) });
      setOpen(false);
      setName("");
      setSlug("");
      setSlugTouched(false);
      setOwner("");
      if (onCreated) onCreated(data.id);
      else router.push(`/companies/${data.id}`);
    } catch (e) {
      toast.error(t("companies.new.failed"), { description: e instanceof ApiError && e.code === "duplicate" ? t("companies.new.slugTaken") : errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus /> {t("companies.new.button")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title={t("companies.new.title")}
        description={t("companies.new.description")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy || !valid}>
              {busy && <Loader2 className="animate-spin" />} {t("companies.new.submit")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted sm:col-span-2">
            {t("companies.new.name")}
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted">
            {t("companies.new.slug")}
            <input
              className={cn(inputCls, slug && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) && "border-danger")}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted">
            {t("companies.new.country")}
            <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
              {["DE", "AT", "CH", "NL", "RO", "AE"].map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted">
            {t("common.plan")}
            <select className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLAN_CATALOGUE.map((p) => (
                <option key={p.code} value={p.code}>
                  {t("companies.new.planOption", { plan: p.name, days: p.trialDays })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted">
            {t("companies.new.seats")}
            <input className={inputCls} type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted sm:col-span-2">
            {t("companies.new.owner")}
            <input className={inputCls} type="email" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
        </div>
      </Dialog>
    </>
  );
}
