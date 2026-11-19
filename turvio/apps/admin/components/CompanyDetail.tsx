"use client";

import { LimitName, PLAN_CATALOGUE, effectiveLimit, findPlan } from "@turvio/shared";
import { Avatar, Badge, Button, Card, CardHeader, Dialog, Field, FormAlert, Input, Skeleton, cn, toast } from "@turvio/web-ui/ds";
import { ArrowLeft, Ban, CalendarClock, Copy, CreditCard, Gauge, Loader2, Mail, RotateCcw, ScrollText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, errorText } from "../lib/api";
import type { MessageKey } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import type { OrgDetail, OrgPatch, OrgStatus } from "../lib/remote";
import { STATUS } from "../lib/status";
import { copyText, listStatus } from "./CompanyTable";

const LIMITS = LimitName.options;
const ROLES = new Set(["owner", "admin", "dispatcher", "driver", "viewer"]);
export const selectCls =
  "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none g:h-8 g:rounded-md g:border-line-2 g:bg-surface-2 g:text-[13px] g:text-ink g:shadow-none";

/** Status a reactivated company returns to: its subscription's state where that is a company state, else active. */
export function reactivationStatus(d: Pick<OrgDetail, "subscription">): OrgStatus {
  const s = d.subscription?.status;
  return s === "trialing" || s === "past_due" ? s : "active";
}

/** `YYYY-MM-DD` of an instant in the viewer's time zone (for a date input). */
function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function roleText(role: string, t: (k: MessageKey) => string) {
  return ROLES.has(role) ? t(`common.role.${role}` as MessageKey) : role;
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink g:font-normal">{children}</dd>
    </div>
  );
}

function UsageBar({ value }: { value: number }) {
  return (
    <div className="h-[3px] w-24 overflow-hidden rounded-full bg-[var(--selected)]">
      <i className={cn("block h-full rounded-full", value >= 1 ? "bg-warning" : "bg-[var(--text-3)]")} style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
    </div>
  );
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: OrgDetail };
type Open = null | "status" | "plan" | "limits" | "trial";

/** One company: subscription, limits and usage, members and pending invitations, with every platform action. */
export function CompanyDetail({ id }: { id: string }) {
  const { t, fmt } = useI18n();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoad({ state: "ready", data: await api<OrgDetail>("GET", `/v1/platform/organizations/${encodeURIComponent(id)}`) });
    } catch (e) {
      setLoad({ state: "error", message: errorText(e) });
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  /** One PATCH with loading state, toasts and a fresh reload; resolves true on success. */
  const patch = async (body: OrgPatch, success: string) => {
    setBusy(true);
    try {
      await api("PATCH", `/v1/platform/organizations/${encodeURIComponent(id)}`, body);
      toast.success(success);
      setOpen(null);
      await reload();
      return true;
    } catch (e) {
      toast.error(t("company.saveFailed"), { description: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const resend = async (invitationId: string) => {
    setResending(invitationId);
    try {
      const r = await api<{ email: string; emailSent: boolean }>("POST", `/v1/platform/organizations/${encodeURIComponent(id)}/invitations/${encodeURIComponent(invitationId)}/resend`);
      if (r.emailSent) toast.success(t("company.inv.resent", { email: r.email }));
      else toast.warning(t("company.inv.renewedNoMail", { email: r.email }));
      await reload();
    } catch (e) {
      toast.error(t("company.inv.resendFailed"), { description: errorText(e) });
    } finally {
      setResending(null);
    }
  };

  if (load.state === "loading")
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
        <Skeleton className="h-10 w-72 rounded-md" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  if (load.state === "error")
    return (
      <div className="flex flex-col items-start gap-3">
        <BackLink />
        <FormAlert>{load.message}</FormAlert>
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          {t("common.retry")}
        </Button>
      </div>
    );

  const d = load.data;
  const sub = d.subscription;
  const plan = sub ? findPlan(sub.planCode) : undefined;
  const st = listStatus({ status: d.status, subscription: sub });
  const suspended = d.status === "suspended";
  const dispatchers = d.members.filter((m) => m.active && m.role === "dispatcher").length;
  const usage: Partial<Record<LimitName, number>> = { max_drivers: d.usage.activeDrivers, max_dispatchers: dispatchers, max_depots: d.usage.depots, max_vehicles: d.usage.vehicles };
  const limitOf = (l: LimitName) => (plan && sub ? effectiveLimit(plan, { seats: sub.seats, limitOverrides: sub.limitOverrides ?? {} }, l) : null);
  const day = (iso: string) => fmt.date(iso, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink />
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={d.name} square size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink g:text-[20px] g:font-semibold g:tracking-[-0.015em]">{d.name}</h1>
                <Badge tone={STATUS[st].tone} dot>
                  {t(`common.status.${st}`)}
                </Badge>
                {sub?.cancelAtPeriodEnd && <Badge tone="warning">{t("company.cancelsAtPeriodEnd")}</Badge>}
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                {d.slug} · {d.countryCode} · {t("company.customerSince", { date: day(d.createdAt) })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">
            <Button variant="secondary" onClick={() => setOpen("plan")}>
              <CreditCard /> {sub ? t("company.changePlan") : t("company.choosePlan")}
            </Button>
            {sub && (
              <>
                <Button variant="secondary" onClick={() => setOpen("limits")}>
                  <Gauge /> {t("company.limits")}
                </Button>
                <Button variant="secondary" onClick={() => setOpen("trial")}>
                  <CalendarClock /> {t("company.trialEnd")}
                </Button>
              </>
            )}
            <Button variant={suspended ? "secondary" : "danger"} onClick={() => setOpen("status")}>
              {suspended ? <RotateCcw /> : <Ban />} {suspended ? t("company.reactivate") : t("company.suspend")}
            </Button>
          </div>
        </div>
      </div>

      {suspended && <FormAlert>{t("company.suspendedNote")}</FormAlert>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={t("company.subscription")} />
          <div className="px-5 py-2 g:px-4">
            {sub ? (
              <dl className="divide-y divide-line">
                <Row label={t("common.plan")}>{plan?.name ?? sub.planName}</Row>
                <Row label={t("company.subStatus")}>{t(`common.status.${sub.status}`)}</Row>
                <Row label={t("company.billing")}>{sub.interval === "year" ? t("company.annual") : t("company.monthly")}</Row>
                <Row label={t("company.seatsLabel")}>{sub.seats}</Row>
                {sub.trialEndsAt && <Row label={t("company.trialEnds")}>{day(sub.trialEndsAt)}</Row>}
                <Row label={sub.cancelAtPeriodEnd || sub.status === "cancelled" ? t("company.ends") : t("company.renews")}>{day(sub.currentPeriodEnd)}</Row>
              </dl>
            ) : (
              <p className="py-3 text-[13px] text-muted">{t("company.noSubscription")}</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("company.usage")} description={t("company.usageDescription", { count: d.usage.toursLast30d })} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("company.limit")}</th>
                  <th scope="col" className="h-9 px-3 text-end font-medium">{t("company.inUse")}</th>
                  <th scope="col" className="h-9 px-5 text-end font-medium g:px-4">{t("company.allowed")}</th>
                </tr>
              </thead>
              <tbody>
                {LIMITS.map((l) => {
                  const used = usage[l];
                  const max = limitOf(l);
                  const overridden = sub?.limitOverrides?.[l] !== undefined;
                  return (
                    <tr key={l} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-2 text-start font-normal text-ink-2 g:px-4">
                        <span className="flex items-center gap-2">
                          {t(`common.limit.${l}`)}
                          {overridden && <Badge tone="outline">{t("company.override")}</Badge>}
                        </span>
                      </th>
                      <td className="px-3 py-2 text-end tabular text-ink">
                        <div className="flex flex-col items-end gap-1">
                          {used === undefined ? <span className="text-muted">—</span> : used}
                          {used !== undefined && max ? <UsageBar value={used / max} /> : null}
                        </div>
                      </td>
                      <td className="px-5 py-2 text-end tabular text-ink g:px-4">{sub ? (max === null ? <span className="text-muted">{t("common.unlimited")}</span> : fmt.number(max)) : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={t("company.members")} description={t("company.membersCount", { count: d.members.length })} />
        {d.members.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-muted g:px-4">{t("company.noMembers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("common.email")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("common.role")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("company.state")}</th>
                  <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("company.since")}</th>
                </tr>
              </thead>
              <tbody>
                {d.members.map((m) => (
                  <tr key={m.membershipId} className="border-b border-line last:border-0 g:hover:bg-[var(--hover)]">
                    <td className="px-5 py-2 text-ink g:px-4">{m.email ?? <span className="text-muted">{t("company.unknownAccount")}</span>}</td>
                    <td className="px-3 py-2 text-ink-2">{roleText(m.role, t)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={m.active ? "success" : "neutral"} dot>
                        {m.active ? t("company.memberActive") : t("company.memberInactive")}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-ink-2 g:px-4">{day(m.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={t("company.invitations")} description={t("company.invitationsDescription")} />
        {d.invitations.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-muted g:px-4">{t("company.noInvitations")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="h-9 px-5 text-start font-medium g:px-4">{t("common.email")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("common.role")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("company.inv.sent")}</th>
                  <th scope="col" className="h-9 px-3 text-start font-medium">{t("company.inv.expires")}</th>
                  <th scope="col" className="h-9 px-5 g:px-4">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.invitations.map((i) => {
                  const expired = new Date(i.expiresAt).getTime() < Date.now();
                  return (
                    <tr key={i.id} className="border-b border-line last:border-0 g:hover:bg-[var(--hover)]">
                      <td className="px-5 py-2 text-ink g:px-4">{i.email}</td>
                      <td className="px-3 py-2 text-ink-2">{roleText(i.role, t)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-2">{day(i.createdAt)}</td>
                      <td className={cn("whitespace-nowrap px-3 py-2", expired ? "text-warning-ink" : "text-ink-2")}>{expired ? t("company.inv.expired") : day(i.expiresAt)}</td>
                      <td className="px-5 py-2 text-end g:px-4">
                        <Button size="sm" variant="secondary" disabled={resending !== null} onClick={() => void resend(i.id)} aria-label={t("company.inv.resendTo", { email: i.email })}>
                          {resending === i.id ? <Loader2 className="animate-spin" /> : <Mail />} {t("company.inv.resend")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/activity?organizationId=${encodeURIComponent(d.id)}`}>
            <ScrollText /> {t("company.viewAudit")}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void copyText(d.id, t("companies.idCopied"), t("common.clipboardFailed"))}>
          <Copy /> {t("companies.copyId")}
        </Button>
        <span className="text-[12px] text-muted">{t("company.privacyNote")}</span>
      </div>

      <StatusDialog open={open === "status"} onClose={() => setOpen(null)} busy={busy} detail={d} onConfirm={() => void patch({ status: suspended ? reactivationStatus(d) : "suspended" }, suspended ? t("company.reactivated", { name: d.name }) : t("company.suspendedToast", { name: d.name }))} />
      <PlanDialog key={`plan-${open === "plan"}`} open={open === "plan"} onClose={() => setOpen(null)} busy={busy} detail={d} onSave={(b) => void patch(b, t("company.planSaved"))} />
      {sub && <LimitsDialog key={`limits-${open === "limits"}`} open={open === "limits"} onClose={() => setOpen(null)} busy={busy} detail={d} onSave={(b) => void patch(b, t("company.limitsSaved"))} />}
      {sub && <TrialDialog key={`trial-${open === "trial"}`} open={open === "trial"} onClose={() => setOpen(null)} busy={busy} detail={d} onSave={(b) => void patch(b, t("company.trialSaved"))} />}
    </>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link href="/companies" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-ink">
      <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("company.back")}
    </Link>
  );
}

function Footer({ busy, onClose, onSave, saveLabel, disabled, danger }: { busy: boolean; onClose: () => void; onSave: () => void; saveLabel: string; disabled?: boolean; danger?: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {t("common.cancel")}
      </Button>
      <Button variant={danger ? "danger" : "primary"} onClick={onSave} disabled={busy || disabled}>
        {busy && <Loader2 className="animate-spin" />} {saveLabel}
      </Button>
    </>
  );
}

type DialogProps<T> = { open: boolean; onClose: () => void; busy: boolean; detail: OrgDetail } & T;

/** Suspend / reactivate: explains that the change takes effect immediately for everyone in the company. */
function StatusDialog({ open, onClose, busy, detail, onConfirm }: DialogProps<{ onConfirm: () => void }>) {
  const { t } = useI18n();
  const suspended = detail.status === "suspended";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={suspended ? t("company.reactivateTitle", { name: detail.name }) : t("company.suspendTitle", { name: detail.name })}
      footer={<Footer busy={busy} onClose={onClose} onSave={onConfirm} danger={!suspended} saveLabel={suspended ? t("company.reactivate") : t("company.suspendConfirm")} />}
    >
      <p className="text-[13px] leading-5 text-ink-2">{suspended ? t("company.reactivateBody") : t("company.suspendBody", { count: detail.members.filter((m) => m.active).length })}</p>
    </Dialog>
  );
}

function PlanDialog({ open, onClose, busy, detail, onSave }: DialogProps<{ onSave: (b: OrgPatch) => void }>) {
  const { t } = useI18n();
  const sub = detail.subscription;
  const [planCode, setPlanCode] = useState(sub?.planCode ?? "team");
  const [seats, setSeats] = useState(String(sub?.seats ?? 1));
  const n = Number(seats);
  const seatsOk = Number.isInteger(n) && n >= 1 && n <= 10000;
  const changed = !sub || planCode !== sub.planCode || n !== sub.seats;
  const body: OrgPatch = {};
  if (!sub || planCode !== sub.planCode) body.planCode = planCode;
  if (!sub || n !== sub.seats) body.seats = n;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={sub ? t("company.changePlan") : t("company.choosePlan")}
      description={sub ? t("company.planDescription") : t("company.planDescriptionNew")}
      footer={<Footer busy={busy} onClose={onClose} onSave={() => onSave(body)} disabled={!seatsOk || !changed} saveLabel={t("common.save")} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("common.plan")} htmlFor="plan-code">
          <select id="plan-code" className={selectCls} value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {PLAN_CATALOGUE.filter((p) => p.active || p.code === sub?.planCode).map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("company.seatsLabel")} htmlFor="plan-seats" error={seatsOk ? null : t("company.seatsInvalid")}>
          <Input id="plan-seats" type="number" min={1} max={10000} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function LimitsDialog({ open, onClose, busy, detail, onSave }: DialogProps<{ onSave: (b: OrgPatch) => void }>) {
  const { t, fmt } = useI18n();
  const sub = detail.subscription!;
  const plan = findPlan(sub.planCode);
  const [values, setValues] = useState<Record<LimitName, string>>(() => Object.fromEntries(LIMITS.map((l) => [l, sub.limitOverrides?.[l] !== undefined ? String(sub.limitOverrides[l]) : ""])) as Record<LimitName, string>);
  const parsed = LIMITS.map((l) => [l, values[l].trim() === "" ? null : Number(values[l])] as const);
  const invalid = new Set(parsed.filter(([, v]) => v !== null && !(Number.isInteger(v) && v >= 1 && v <= 1_000_000)).map(([l]) => l));
  const planDefault = (l: LimitName) => {
    if (!plan) return "—";
    if (l === "max_drivers" && plan.pricingModel === "per_driver") return t("company.planDefaultSeats", { count: sub.seats });
    const v = plan.limits[l];
    return v == null ? t("common.unlimited") : fmt.number(v);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t("company.limitsTitle")}
      description={t("company.limitsDescription")}
      footer={<Footer busy={busy} onClose={onClose} onSave={() => onSave({ limitOverrides: Object.fromEntries(parsed) })} disabled={invalid.size > 0} saveLabel={t("common.save")} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LIMITS.map((l) => (
          <Field key={l} label={t(`common.limit.${l}`)} htmlFor={`limit-${l}`} hint={<span className="text-[11.5px] text-muted">{t("company.planDefault", { value: planDefault(l) })}</span>} error={invalid.has(l) ? t("company.limitInvalid") : null}>
            <Input id={`limit-${l}`} type="number" min={1} inputMode="numeric" placeholder={t("company.usePlanDefault")} value={values[l]} onChange={(e) => setValues((v) => ({ ...v, [l]: e.target.value }))} />
          </Field>
        ))}
      </div>
    </Dialog>
  );
}

function TrialDialog({ open, onClose, busy, detail, onSave }: DialogProps<{ onSave: (b: OrgPatch) => void }>) {
  const { t } = useI18n();
  const sub = detail.subscription!;
  const [day, setDay] = useState(sub.trialEndsAt ? localDay(sub.trialEndsAt) : "");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t("company.trialTitle")}
      description={t("company.trialDescription")}
      footer={
        <>
          {sub.trialEndsAt && (
            <Button variant="ghost" className="me-auto" disabled={busy} onClick={() => onSave({ trialEndsAt: null })}>
              {t("company.trialRemove")}
            </Button>
          )}
          <Footer busy={busy} onClose={onClose} onSave={() => onSave({ trialEndsAt: new Date(`${day}T23:59:59`).toISOString() })} disabled={!valid} saveLabel={t("common.save")} />
        </>
      }
    >
      <Field label={t("company.trialEnds")} htmlFor="trial-end">
        <Input id="trial-end" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </Field>
    </Dialog>
  );
}
