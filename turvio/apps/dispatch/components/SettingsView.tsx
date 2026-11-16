"use client";

import { can } from "@turvio/shared";
import { Badge, Button, Card, CardHeader, Checkbox, Dialog, Input, Skeleton, THEME_KEY, cn, toast, useTheme } from "@turvio/web-ui/ds";
import { Building2, ExternalLink, Loader2, Lock, MapPinned, Plus, Radio, RefreshCw, Settings2, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { LOCALE_NAMES, LOCALES, type Locale } from "../lib/i18n";
import { useI18n } from "../lib/i18n/client";
import { TRACKING_STATE, modeLabel, settingsApi, trackingStateExplain, trackingStateLabel, type CompanySettings, type DriverTracking, type Preferences, type TrackingDrivers, type TrackingMode } from "../lib/settings";
import { ageLabel } from "../lib/live";
import { useDispatch } from "../lib/store";
import { roleLabel } from "./DispatchShell";

type Section = "preferences" | "company" | "driver-rules" | "tracking" | "team";

/**
 * Settings: personal preferences (every user) and company settings (read by staff, changed by
 * company admins – the API enforces the same rules and asks for the second factor).
 */
export function SettingsView() {
  const { session } = useDispatch();
  const { t, tr } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const api = useMemo(() => settingsApi(session.organizationId), [session.organizationId]);
  const [overview, setOverview] = useState<CompanySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadOverview = useCallback(async () => {
    try {
      setOverview(await api.overview());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [api]);
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const seesTracking = can(session.role, "tracking.view_live");
  const sections: { key: Section; label: string; icon: ReactNode; show: boolean }[] = [
    { key: "preferences", label: t("settings.section.preferences"), icon: <UserRound />, show: true },
    { key: "company", label: t("settings.section.company"), icon: <Building2 />, show: true },
    { key: "driver-rules", label: t("settings.section.driverRules"), icon: <Smartphone />, show: true },
    { key: "tracking", label: t("settings.section.tracking"), icon: <Radio />, show: seesTracking },
    { key: "team", label: t("settings.section.team"), icon: <ShieldCheck />, show: true },
  ];
  const visible = sections.filter((s) => s.show);
  const raw = params?.get("section") as Section | null;
  const section: Section = visible.some((s) => s.key === raw) ? raw! : "preferences";
  const go = (s: Section) => router.replace(`${pathname ?? "/settings"}?section=${s}`, { scroll: false });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{t("shell.title.settings")}</h1>
        <p className="text-sm text-ink-2">
          {tr("settings.intro", { org: session.organizationName })}{" "}
          {overview && !overview.canEdit.company && <span className="text-muted">{t("settings.readOnlyCompany")}</span>}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        <nav aria-label={t("settings.nav")} className="flex gap-1 overflow-x-auto lg:flex-col">
          {visible.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              aria-current={section === s.key ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-4",
                section === s.key && "bg-brand-50 text-brand-700 hover:bg-brand-50",
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {error && (
            <Card className="p-5 text-[13px] text-danger-ink" role="alert">
              {error}
            </Card>
          )}
          {section === "preferences" && <PreferencesSection />}
          {section !== "preferences" && !overview && !error && <Skeleton className="h-64" />}
          {section === "company" && overview && <CompanySection data={overview} onSaved={loadOverview} />}
          {section === "driver-rules" && overview && <DriverRulesSection data={overview} onSaved={loadOverview} />}
          {section === "tracking" && overview && seesTracking && <TrackingSection data={overview} onChanged={loadOverview} />}
          {section === "team" && overview && <TeamSection data={overview} />}
        </div>
      </div>
    </div>
  );
}

function ReadOnlyNote() {
  const { t } = useI18n();
  return (
    <p className="flex items-center gap-1.5 text-2xs text-muted">
      <Lock className="size-3.5" /> {t("settings.readOnly")}
    </p>
  );
}

// ---------------------------------------------------------------- personal preferences
function PreferencesSection() {
  const { session, scoped, setDepotId } = useDispatch();
  const api = settingsApi(session.organizationId);
  const [, setTheme] = useTheme();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [theme, setThemeChoice] = useState<Preferences["theme"]>("system");
  const [depot, setDepot] = useState("");
  const [toursView, setToursView] = useState<"day" | "all" | "archived">("day");
  const [busy, setBusy] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const [langBusy, setLangBusy] = useState(false);
  // Language: switches at once and is saved with the account (applies on every computer).
  const chooseLanguage = async (l: Locale) => {
    if (l === locale) return;
    const before = locale;
    setLocale(l);
    setLangBusy(true);
    try {
      const p = await api.savePreferences({ language: l });
      setPrefs(p);
    } catch (e) {
      setLocale(before);
      toast.error(t("settings.languageNotSaved"), { description: errorMessage(e) });
    } finally {
      setLangBusy(false);
    }
  };
  useEffect(() => {
    api.preferences().then(
      (p) => {
        setPrefs(p);
        setThemeChoice(p.theme);
        const d = p.orgDefaults[session.organizationId];
        setDepot(d?.defaultDepotId ?? "");
        setToursView(d?.toursView ?? "day");
      },
      (e) => toast.error(t("settings.prefsNotLoaded"), { description: errorMessage(e) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.organizationId]);
  const applyTheme = (th: Preferences["theme"]) => {
    if (th === "system") {
      try {
        localStorage.removeItem(THEME_KEY);
      } catch {
        /* private mode */
      }
      document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } else setTheme(th);
  };
  const save = async () => {
    setBusy(true);
    try {
      const p = await api.savePreferences({ theme, orgDefaults: { [session.organizationId]: { defaultDepotId: depot || null, toursView } } });
      setPrefs(p);
      applyTheme(theme);
      if (depot) setDepotId(depot);
      toast.success(t("settings.prefsSaved"), { description: t("settings.prefsSavedDesc") });
    } catch (e) {
      toast.error(t("settings.notSaved"), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  if (!prefs) return <Skeleton className="h-64" />;
  return (
    <Card className="flex flex-col gap-5 p-5">
      <CardHeader className="-mx-5 -mt-5" title={t("settings.section.preferences")} description={t("settings.prefsDesc")} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-ink">{t("shell.language")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("shell.language")} data-testid="language-choice">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              disabled={langBusy}
              onClick={() => void chooseLanguage(l)}
              className={cn("h-10 rounded-xl border border-line px-4 text-[13px] font-semibold text-ink-2 hover:border-line-strong disabled:opacity-60", locale === l && "border-brand-500 bg-brand-50 text-brand-700")}
            >
              <span lang={l} dir={l === "ar" ? "rtl" : "ltr"}>
                {LOCALE_NAMES[l]}
              </span>
            </button>
          ))}
        </div>
        <span className="text-2xs text-muted">{t("shell.languageHint")}</span>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-ink">{t("settings.appearance")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("settings.appearance")}>
          {(["system", "light", "dark"] as const).map((th) => (
            <button
              key={th}
              type="button"
              role="radio"
              aria-checked={theme === th}
              onClick={() => {
                setThemeChoice(th);
                applyTheme(th);
              }}
              className={cn("h-10 rounded-xl border border-line px-4 text-[13px] font-semibold text-ink-2 hover:border-line-strong", theme === th && "border-brand-500 bg-brand-50 text-brand-700")}
            >
              {t(`settings.theme.${th}`)}
            </button>
          ))}
        </div>
        <span className="text-2xs text-muted">{t("settings.appearanceHint")}</span>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          {t("settings.defaultLocation")}
          <select className={fieldCls} value={depot} onChange={(e) => setDepot(e.target.value)} aria-label={t("settings.defaultLocation")}>
            <option value="">{t("settings.allMyLocations")}</option>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted">{t("settings.defaultLocationHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          {t("settings.toursOpensWith")}
          <select className={fieldCls} value={toursView} onChange={(e) => setToursView(e.target.value as typeof toursView)} aria-label={t("settings.toursOpensWith")}>
            <option value="day">{t("settings.toursView.day")}</option>
            <option value="all">{t("settings.toursView.all")}</option>
            <option value="archived">{t("settings.toursView.archived")}</option>
          </select>
        </label>
      </div>
      <div>
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {t("settings.savePreferences")}
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- company
function CompanySection({ data, onSaved }: { data: CompanySettings; onSaved: () => void }) {
  const { session } = useDispatch();
  const { t } = useI18n();
  const c = data.company;
  const editable = data.canEdit.company;
  const [form, setForm] = useState({
    name: c.name,
    contactEmail: c.contactEmail ?? "",
    contactPhone: c.contactPhone ?? "",
    addressStreet: c.address.street ?? "",
    addressPostalCode: c.address.postalCode ?? "",
    addressCity: c.address.city ?? "",
    addressCountry: c.address.country,
    website: c.website ?? "",
  });
  const [busy, setBusy] = useState(false);
  const original: typeof form = {
    name: c.name,
    contactEmail: c.contactEmail ?? "",
    contactPhone: c.contactPhone ?? "",
    addressStreet: c.address.street ?? "",
    addressPostalCode: c.address.postalCode ?? "",
    addressCity: c.address.city ?? "",
    addressCountry: c.address.country,
    website: c.website ?? "",
  };
  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== original[k as keyof typeof form]).map(([k, v]) => [k, v.trim() === "" && k !== "name" ? null : v.trim()]));
  const save = async () => {
    setBusy(true);
    try {
      await settingsApi(session.organizationId).saveCompany(changed);
      toast.success(t("settings.companySaved"), { description: t("settings.auditLogged") });
      onSaved();
    } catch (e) {
      toast.error(t("settings.notSaved"), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const field = (k: keyof typeof form, label: string, props: { type?: string; placeholder?: string; className?: string; maxLength?: number; ltr?: boolean } = {}) => (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-medium text-ink-2", props.className)}>
      {label}
      <Input value={form[k]} disabled={!editable} dir={props.ltr ? "ltr" : undefined} type={props.type} placeholder={props.placeholder} maxLength={props.maxLength} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-label={label} />
    </label>
  );
  return (
    <Card className="flex flex-col gap-5 p-5">
      <CardHeader className="-mx-5 -mt-5" title={t("settings.section.company")} description={t("settings.companyDesc")} />
      {!editable && <ReadOnlyNote />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("name", t("settings.field.name"), { className: "sm:col-span-2", maxLength: 160 })}
        {field("contactEmail", t("settings.field.contactEmail"), { type: "email", ltr: true })}
        {field("contactPhone", t("settings.field.contactPhone"), { placeholder: "+49 …", ltr: true })}
        {field("addressStreet", t("settings.field.street"), { className: "sm:col-span-2" })}
        {field("addressPostalCode", t("settings.field.postalCode"), { ltr: true })}
        {field("addressCity", t("settings.field.city"))}
        {field("addressCountry", t("settings.field.country"), { maxLength: 2, ltr: true })}
        {field("website", t("settings.field.website"), { placeholder: "https://", ltr: true })}
      </div>
      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface-2 p-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.timeZone")}</dt>
          <dd className="font-semibold text-ink">{c.timeZone}</dd>
          <dd className="text-2xs text-muted">{t("settings.timeZoneHint")}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.podRetention")}</dt>
          <dd className="font-semibold text-ink">{t("settings.days", { count: data.proofRetentionDays })}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.plan")}</dt>
          <dd className="font-semibold text-ink">{data.subscription ? `${data.subscription.plan} · ${data.subscription.status}` : t("settings.planHidden")}</dd>
        </div>
      </dl>
      {editable && (
        <div>
          <Button variant="primary" onClick={() => void save()} disabled={busy || Object.keys(changed).length === 0 || !form.name.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            {t("settings.saveCompany")}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- driver app rules
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

function DriverRulesSection({ data, onSaved }: { data: CompanySettings; onSaved: () => void }) {
  const { session } = useDispatch();
  const { t } = useI18n();
  const editable = data.canEdit.driverRules;
  const r = data.driverRules;
  const [reasons, setReasons] = useState(r.failureReasons.map((x) => ({ ...x, label: x.label ?? "" })));
  const [phone, setPhone] = useState(r.showRecipientPhone);
  const [podLocation, setPodLocation] = useState(r.podLocation);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const known = new Set(r.failureReasons.map((x) => x.code));
  const newCode = slug(newLabel);
  const save = async () => {
    setBusy(true);
    try {
      await settingsApi(session.organizationId).saveDriverRules({
        failureReasons: reasons.map((x) => ({ code: x.code, ...(x.label.trim() ? { label: x.label.trim() } : {}), ...(x.requiresNote ? { requiresNote: true } : {}) })),
        showRecipientPhone: phone,
        podLocation,
      });
      toast.success(t("settings.rulesSaved"), { description: t("settings.rulesSavedDesc") });
      onSaved();
    } catch (e) {
      toast.error(t("settings.notSaved"), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-col gap-5 p-5">
      <CardHeader className="-mx-5 -mt-5" title={t("settings.section.driverRules")} description={t("settings.rulesDesc")} />
      {!editable && <ReadOnlyNote />}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-[13px]">
          <Checkbox checked={phone} onCheckedChange={(c) => editable && setPhone(c === true)} label={t("settings.showPhone")} />
          <span>
            <span className="font-semibold text-ink">{t("settings.showPhone")}</span>
            <span className="block text-2xs text-muted">{t("settings.showPhoneHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-[13px]">
          <Checkbox checked={podLocation} onCheckedChange={(c) => editable && setPodLocation(c === true)} label={t("settings.podLocation")} />
          <span>
            <span className="font-semibold text-ink">{t("settings.podLocation")}</span>
            <span className="block text-2xs text-muted">{t("settings.podLocationHint")}</span>
          </span>
        </label>
      </div>
      <section aria-label={t("settings.failureReasons")} className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{t("settings.reasonsTitle")}</h3>
        <p className="text-2xs text-muted">
          {r.customFailureReasons ? t("settings.reasonsOwn") : t("settings.reasonsStandard")} {t("settings.reasonsNoRemove")}
        </p>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {reasons.map((x, i) => (
            <li key={x.code} className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[180px_1fr_auto]">
              <code className="text-2xs text-muted" dir="ltr">
                {x.code}
              </code>
              <Input value={x.label} disabled={!editable} placeholder={t("settings.labelPlaceholder")} maxLength={80} onChange={(e) => setReasons(reasons.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} aria-label={t("settings.labelFor", { code: x.code })} />
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <Checkbox checked={!!x.requiresNote} onCheckedChange={(c) => editable && setReasons(reasons.map((y, j) => (j === i ? { ...y, requiresNote: c === true } : y)))} label={t("settings.noteRequiredFor", { code: x.code })} />
                {t("settings.noteRequired")}
              </label>
            </li>
          ))}
        </ul>
        {editable && reasons.length < 30 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
              {t("settings.newReason")}
              <Input value={newLabel} maxLength={80} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("settings.newReasonPlaceholder")} aria-label={t("settings.newReason")} className="w-64" />
            </label>
            <Button
              variant="secondary"
              disabled={newCode.length < 2 || reasons.some((x) => x.code === newCode)}
              onClick={() => {
                setReasons([...reasons, { code: newCode, label: newLabel.trim(), requiresNote: false }]);
                setNewLabel("");
              }}
            >
              <Plus /> {t("settings.addReason")}
            </Button>
            {newCode.length >= 2 && <span className="pb-2 text-2xs text-muted">{t("settings.codeValue", { code: newCode })}</span>}
          </div>
        )}
      </section>
      {editable && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {t("settings.saveRules")}
          </Button>
          {reasons.some((x) => !known.has(x.code)) && <span className="text-2xs text-muted">{t("settings.newReasonsUnsaved", { count: reasons.filter((x) => !known.has(x.code)).length })}</span>}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- live tracking administration
function TrackingSection({ data, onChanged }: { data: CompanySettings; onChanged: () => void }) {
  const { session } = useDispatch();
  const { t, locale } = useI18n();
  const api = settingsApi(session.organizationId);
  const admin = data.canEdit.tracking;
  const [list, setList] = useState<TrackingDrivers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modeDialog, setModeDialog] = useState<TrackingMode | null>(null);
  const [pilotDialog, setPilotDialog] = useState<{ ids: string[]; enabled: boolean } | null>(null);
  const [noticeDialog, setNoticeDialog] = useState(false);
  const load = useCallback(async () => {
    try {
      setList(await api.trackingDrivers());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.organizationId]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);
  const refreshAll = () => {
    void load();
    onChanged();
  };
  const tk = data.tracking;
  const mode = list?.mode ?? tk.mode;
  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-5">
        <CardHeader
          className="-mx-5 -mt-5"
          title={t("settings.section.tracking")}
          description={t("settings.trackingDesc")}
          actions={
            <Button variant="secondary" size="icon-sm" onClick={() => void load()} aria-label={t("settings.refresh")}>
              <RefreshCw />
            </Button>
          }
        />
        {!admin && <ReadOnlyNote />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("settings.trackingMode")}>
          {(["off", "pilot", "active_tours"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={!admin || mode === m}
              onClick={() => setModeDialog(m)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-start transition-colors enabled:hover:border-line-strong disabled:cursor-default",
                mode === m && "border-brand-500 bg-brand-50",
              )}
            >
              <span className={cn("text-[14px] font-bold text-ink", mode === m && "text-brand-700")}>{modeLabel(m, t)}</span>
              <span className="text-2xs text-muted">{t(`settings.modeDesc.${m}`, { limit: tk.pilotLimit })}</span>
              {mode === m && <Badge tone="brand">{t("settings.current")}</Badge>}
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.noticeVersion")}</dt>
            <dd className="font-semibold text-ink tabular">{tk.noticeVersion}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.acknowledged")}</dt>
            <dd className="font-semibold text-ink tabular">{t("settings.acknowledgedValue", { ack: tk.acknowledgedCurrentNotice, count: tk.activeDrivers })}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.positionInterval")}</dt>
            <dd className="font-semibold text-ink tabular">{t("common.sec", { n: tk.intervalSeconds })}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">{t("settings.historyKept")}</dt>
            <dd className="font-semibold text-ink tabular">{t("settings.days", { count: tk.retentionDays })}</dd>
          </div>
        </dl>
        {admin && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setNoticeDialog(true)}>
              {t("settings.requireNewAck")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h3 className="text-[15px] font-bold text-ink">{t("settings.drivers")}</h3>
          {list && (
            <span className="text-2xs text-muted">
              {Object.entries(list.summary)
                .map(([k, n]) => {
                  const label = trackingStateLabel(k as keyof typeof TRACKING_STATE, t);
                  // English lists states in lower case ("2 live"); German nouns keep their capital.
                  return t("settings.summaryItem", { count: n, label: locale === "en" ? label.toLowerCase() : label });
                })
                .join(" · ")}{" "}
              · {t("settings.staleNote", { n: Math.round(list.staleAfterSeconds / 60) })}
            </span>
          )}
          {admin && selected.size > 0 && (
            <div className="ms-auto flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setPilotDialog({ ids: [...selected], enabled: true })}>
                {t("settings.addToPilotN", { count: selected.size })}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPilotDialog({ ids: [...selected], enabled: false })}>
                {t("settings.removeFromPilotN", { count: selected.size })}
              </Button>
            </div>
          )}
        </div>
        {error && <p className="px-4 py-4 text-[13px] text-danger-ink">{error}</p>}
        {!list && !error && <Skeleton className="m-4 h-40" />}
        {list && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]" aria-label={t("settings.tableLabel")}>
              <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                <tr className="border-b border-line">
                  {admin && <th className="h-10 w-10 ps-4" aria-label={t("settings.select")} />}
                  <th className="px-3 text-start">{t("settings.col.driver")}</th>
                  <th className="px-3 text-start">{t("settings.col.location")}</th>
                  <th className="px-3 text-start">{t("settings.col.pilot")}</th>
                  <th className="px-3 text-start">{t("settings.col.status")}</th>
                  <th className="px-3 text-start">{t("settings.col.notice")}</th>
                  <th className="px-3 text-start">{t("settings.col.activeTour")}</th>
                  <th className="pe-4 ps-3 text-start">{t("settings.col.lastPosition")}</th>
                </tr>
              </thead>
              <tbody>
                {list.drivers.map((d) => (
                  <DriverRow key={d.driverId} d={d} admin={admin} noticeVersion={list.noticeVersion} selected={selected.has(d.driverId)} onSelect={() => toggle(d.driverId)} onPilot={(on) => setPilotDialog({ ids: [d.driverId], enabled: on })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-4 py-2.5 text-2xs text-muted">
          {t("settings.privacyFooter")}
        </p>
      </Card>

      {modeDialog && <ModeDialog to={modeDialog} drivers={list?.drivers ?? []} pilotLimit={tk.pilotLimit} onClose={() => setModeDialog(null)} onDone={refreshAll} />}
      {pilotDialog && <PilotDialog {...pilotDialog} names={(list?.drivers ?? []).filter((d) => pilotDialog.ids.includes(d.driverId)).map((d) => d.name)} onClose={() => setPilotDialog(null)} onDone={() => (setSelected(new Set()), refreshAll())} />}
      {noticeDialog && (
        <SimpleConfirm
          title={t("settings.noticeTitle")}
          body={t("settings.noticeBody")}
          label={t("settings.noticeLabel")}
          onClose={() => setNoticeDialog(false)}
          run={async () => {
            await api.setTracking({ newNoticeVersion: true });
            toast.success(t("settings.noticeToast"));
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function DriverRow({ d, admin, noticeVersion, selected, onSelect, onPilot }: { d: DriverTracking; admin: boolean; noticeVersion: number; selected: boolean; onSelect: () => void; onPilot: (on: boolean) => void }) {
  const { t, fmt } = useI18n();
  const st = TRACKING_STATE[d.state];
  const toneCls = { success: "bg-success-soft text-success-ink", warning: "bg-warning-soft text-warning-ink", danger: "bg-danger-soft text-danger-ink", neutral: "bg-surface-2 text-muted", info: "bg-info-soft text-info-ink" }[st.tone];
  return (
    <tr className="border-b border-line last:border-0">
      {admin && (
        <td className="ps-4">
          <Checkbox checked={selected} onCheckedChange={onSelect} label={t("settings.selectName", { name: d.name })} />
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-ink">{d.name}</td>
      <td className="whitespace-nowrap px-3 text-ink-2">{d.depotName ?? "–"}</td>
      <td className="px-3">
        {admin ? (
          <button
            type="button"
            role="switch"
            aria-checked={d.pilot}
            aria-label={t("settings.pilotFor", { name: d.name })}
            onClick={() => onPilot(!d.pilot)}
            className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors", d.pilot ? "bg-brand-600" : "bg-surface-3")}
          >
            <span className={cn("inline-block size-5 rounded-full bg-white shadow-xs transition-transform", d.pilot ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5")} />
          </button>
        ) : (
          <span className="text-ink-2">{d.pilot ? t("common.yes") : t("common.no")}</span>
        )}
      </td>
      <td className="px-3">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-bold", toneCls)} title={trackingStateExplain(d.state, t)}>
          {d.state === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
          {trackingStateLabel(d.state, t)}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 text-2xs">
        {d.acknowledgedCurrent ? (
          <span className="text-success-ink">{t("settings.ackCurrent", { version: d.acknowledgedVersion, date: fmt.date(d.acknowledgedAt!, { dateStyle: "short" }) })}</span>
        ) : d.acknowledgedVersion ? (
          <span className="text-warning-ink">{t("settings.ackPending", { from: d.acknowledgedVersion, to: noticeVersion })}</span>
        ) : (
          <span className="text-muted">{t("settings.notAcknowledged")}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 text-ink-2">{d.currentTour ? (d.currentTour.status === "paused" ? t("settings.tourPaused", { name: d.currentTour.name }) : d.currentTour.name) : "–"}</td>
      <td className="whitespace-nowrap pe-4 ps-3 text-ink-2 tabular">{d.positionAgeSeconds !== null ? ageLabel(d.positionAgeSeconds, t) : "–"}</td>
    </tr>
  );
}

function SimpleConfirm({ title, body, label, onClose, run, disabled, children }: { title: string; body: ReactNode; label: string; onClose: () => void; run: () => Promise<void>; disabled?: boolean; children?: ReactNode }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={busy || disabled}
            onClick={async () => {
              setBusy(true);
              try {
                await run();
                onClose();
              } catch (e) {
                toast.error(t("settings.notChanged"), { description: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-[13px] text-ink-2">
        {typeof body === "string" ? <p>{body}</p> : body}
        {children}
      </div>
    </Dialog>
  );
}

function ModeDialog({ to, drivers, pilotLimit, onClose, onDone }: { to: TrackingMode; drivers: DriverTracking[]; pilotLimit: number; onClose: () => void; onDone: () => void }) {
  const { session } = useDispatch();
  const api = settingsApi(session.organizationId);
  const { t } = useI18n();
  const pilots = drivers.filter((d) => d.pilot);
  const [confirmed, setConfirmed] = useState(false);
  const body =
    to === "off" ? (
      <p>{t("settings.offBody")}</p>
    ) : to === "pilot" ? (
      pilots.length === 0 ? (
        <p className="text-warning-ink">{t("settings.noPilots")}</p>
      ) : (
        <p>{t("settings.pilotBody", { count: pilots.length, names: pilots.map((p) => p.name).join(", "), limit: pilotLimit })}</p>
      )
    ) : (
      <p>{t("settings.activeBody")}</p>
    );
  const needs = to === "pilot" ? t("settings.needsPilot") : to === "active_tours" ? t("settings.needsActive") : null;
  return (
    <SimpleConfirm
      title={t("settings.switchTitle", { mode: modeLabel(to, t) })}
      body={body}
      label={t("settings.switch")}
      onClose={onClose}
      disabled={(needs !== null && !confirmed) || (to === "pilot" && pilots.length === 0)}
      run={async () => {
        await api.setTracking(
          to === "off"
            ? { mode: "off" }
            : to === "pilot"
              ? { mode: "pilot", pilotDriverIds: pilots.map((p) => p.driverId), confirmPilotConsent: true }
              : { mode: "active_tours", confirmPrerequisites: true },
        );
        toast.success(t("settings.switchedToast", { mode: modeLabel(to, t) }), { description: t("settings.recordedWithName") });
        onDone();
      }}
    >
      {needs && (
        <label className="flex items-start gap-2">
          <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} label={t("settings.confirmPrereq")} />
          <span>{needs}</span>
        </label>
      )}
      <p className="text-2xs text-muted">{t("settings.ackNotConsent")}</p>
    </SimpleConfirm>
  );
}

function PilotDialog({ ids, enabled, names, onClose, onDone }: { ids: string[]; enabled: boolean; names: string[]; onClose: () => void; onDone: () => void }) {
  const { session } = useDispatch();
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(!enabled);
  return (
    <SimpleConfirm
      title={t(enabled ? "settings.addPilotTitle" : "settings.removePilotTitle", { count: ids.length })}
      body={<p>{names.join(", ")}</p>}
      label={enabled ? t("settings.addToPilot") : t("settings.removeFromPilot")}
      onClose={onClose}
      disabled={!confirmed}
      run={async () => {
        const r = await settingsApi(session.organizationId).setPilots(ids, enabled);
        toast.success(t("settings.pilotChanged", { count: r.changed, pilots: r.pilots }));
        onDone();
      }}
    >
      {enabled && (
        <label className="flex items-start gap-2">
          <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} label={t("settings.eachAgreed")} />
          <span>{t("settings.eachAgreedText")}</span>
        </label>
      )}
    </SimpleConfirm>
  );
}

// ---------------------------------------------------------------- team & roles
const KEY_PERMISSIONS = [
  "tours.manage",
  "tours.close",
  "tours.archive",
  "tours.delete",
  "tracking.view_live",
  "reports.view",
  "reports.export",
  "org.members.manage",
  "org.settings.manage",
] as const;

function TeamSection({ data }: { data: CompanySettings }) {
  const { t } = useI18n();
  const roles = ["owner", "admin", "dispatcher", "driver"].filter((r) => data.roles[r]);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-2 p-5">
          <ShieldCheck className="size-5 text-brand-600" />
          <h3 className="text-[15px] font-bold text-ink">{t("settings.team")}</h3>
          <p className="text-[13px] text-ink-2">{t("settings.teamDesc")}</p>
          {data.canEdit.team ? (
            <Link href="/fleet?tab=team" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:underline">
              {t("settings.openTeam")} <ExternalLink className="size-3.5 rtl:-scale-x-100" />
            </Link>
          ) : (
            <span className="text-2xs text-muted">{t("settings.managedByAdmins")}</span>
          )}
        </Card>
        <Card className="flex flex-col gap-2 p-5">
          <MapPinned className="size-5 text-brand-600" />
          <h3 className="text-[15px] font-bold text-ink">{t("settings.locations")}</h3>
          <p className="text-[13px] text-ink-2">{t("settings.locationsDesc")}</p>
          <Link href="/fleet?tab=depots" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:underline">
            {t("settings.openLocations")} <ExternalLink className="size-3.5 rtl:-scale-x-100" />
          </Link>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title={t("settings.rolesTitle")} description={t("settings.rolesDesc", { role: roleLabel(data.yourRole, t) })} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]" aria-label={t("settings.rolesTable")}>
            <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
              <tr className="border-b border-line">
                <th className="h-10 ps-5 text-start">{t("settings.permission")}</th>
                {roles.map((r) => (
                  <th key={r} className="px-3 text-center">
                    {roleLabel(r, t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KEY_PERMISSIONS.map((p) => (
                <tr key={p} className="border-b border-line last:border-0">
                  <td className="py-2 ps-5 text-ink-2">{t(`settings.perm.${p}`)}</td>
                  {roles.map((r) => (
                    <td key={r} className="px-3 text-center">
                      {data.roles[r]!.includes(p) ? <span className="font-bold text-success-ink" aria-label={t("settings.ariaYes")}>✓</span> : <span className="text-subtle" aria-label={t("settings.ariaNo")}>–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="flex items-center gap-1.5 text-2xs text-muted">
        <Settings2 className="size-3.5" /> {t("settings.rolesEnforced")}
      </p>
    </div>
  );
}
