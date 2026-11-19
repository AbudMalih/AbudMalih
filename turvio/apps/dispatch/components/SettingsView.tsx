"use client";

import { can } from "@turvio/shared";
import { Badge, Button, Card, CardHeader, Checkbox, Dialog, Input, Skeleton, applyThemePreference, cn, toast } from "@turvio/web-ui/ds";
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
 * Phase G: a section is one flat bordered form – header, then groups separated by hairlines
 * (no inner cards), 12 px muted labels above 32 px controls.
 */
const G_FORM = "g:gap-0 g:p-0";
const G_HEAD = "g:mx-0 g:mt-0";
const G_GROUP = "g:px-4 g:py-3.5";
const G_GROUP_T = "g:border-t g:border-line g:px-4 g:py-3.5";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted";
const LEGEND = "mb-1 text-[13px] font-semibold text-ink g:mb-1.5 g:text-[12px] g:font-normal g:text-muted";
/** Segmented control in G (classic: separate bordered buttons). */
const SEG = "flex flex-wrap gap-2 g:inline-flex g:w-fit g:max-w-full g:gap-0.5 g:rounded-md g:border g:border-line-2 g:bg-surface-2 g:p-0.5";
const SEG_ITEM = "h-10 rounded-xl border border-line px-4 text-[13px] font-semibold text-ink-2 hover:border-line-strong g:h-7 g:rounded g:border-0 g:px-3 g:font-medium g:text-muted g:hover:text-ink";
const SEG_ON = "border-brand-500 bg-brand-50 text-brand-700 g:bg-[var(--selected)] g:text-ink";
const DT = "text-2xs uppercase tracking-[0.08em] text-muted g:text-[12px]";
const DD = "font-semibold text-ink g:font-medium";

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
    <div className="flex flex-col gap-5 g:gap-4">
      <div className="flex flex-col gap-1 g:gap-0.5">
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink g:text-[20px] g:font-semibold g:tracking-[-0.015em]">{t("shell.title.settings")}</h1>
        <p className="text-sm text-ink-2 g:text-[13px] g:text-muted">
          {tr("settings.intro", { org: session.organizationName })}{" "}
          {overview && !overview.canEdit.company && <span className="text-muted">{t("settings.readOnlyCompany")}</span>}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr] g:gap-4 g:lg:grid-cols-[200px_1fr] g:lg:gap-6">
        <nav aria-label={t("settings.nav")} className="flex gap-1 overflow-x-auto lg:flex-col g:gap-px">
          {visible.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(s.key)}
              aria-current={section === s.key ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-4 g:h-[30px] g:gap-2 g:rounded-md g:px-2.5 g:text-[13px] g:font-medium g:hover:bg-[var(--hover)] g:[&_svg]:size-[15px] g:[&_svg]:text-muted",
                section === s.key && "bg-brand-50 text-brand-700 hover:bg-brand-50 g:bg-[var(--selected)] g:text-ink g:hover:bg-[var(--selected)]",
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {error && (
            <Card className="p-5 text-[13px] text-danger-ink g:mb-4 g:p-4" role="alert">
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

function ReadOnlyNote({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cn("flex items-center gap-1.5 text-2xs text-muted g:text-[12px]", className)}>
      <Lock className="size-3.5" /> {t("settings.readOnly")}
    </p>
  );
}

// ---------------------------------------------------------------- personal preferences
function PreferencesSection() {
  const { session, scoped, setDepotId } = useDispatch();
  const api = settingsApi(session.organizationId);
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
  const applyTheme = (th: Preferences["theme"]) => applyThemePreference(th);
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
    <Card className={cn("flex flex-col gap-5 p-5", G_FORM)}>
      <CardHeader className={cn("-mx-5 -mt-5", G_HEAD)} title={t("settings.section.preferences")} description={t("settings.prefsDesc")} />
      {/* Group padding sits on a wrapper: a fieldset puts its legend above its own padding. */}
      <div className={G_GROUP}>
      <fieldset className="flex flex-col gap-2 g:gap-1.5">
        <legend className={LEGEND}>{t("shell.language")}</legend>
        <div className={SEG} role="radiogroup" aria-label={t("shell.language")} data-testid="language-choice">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              disabled={langBusy}
              onClick={() => void chooseLanguage(l)}
              className={cn(SEG_ITEM, "disabled:opacity-60", locale === l && SEG_ON)}
            >
              <span lang={l} dir={l === "ar" ? "rtl" : "ltr"}>
                {LOCALE_NAMES[l]}
              </span>
            </button>
          ))}
        </div>
        <span className="text-2xs text-muted g:text-[12px]">{t("shell.languageHint")}</span>
      </fieldset>
      </div>
      <div className={G_GROUP_T}>
      <fieldset className="flex flex-col gap-2 g:gap-1.5">
        <legend className={LEGEND}>{t("settings.appearance")}</legend>
        <div className={SEG} role="radiogroup" aria-label={t("settings.appearance")}>
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
              className={cn(SEG_ITEM, theme === th && SEG_ON)}
            >
              {t(`settings.theme.${th}`)}
            </button>
          ))}
        </div>
        <span className="text-2xs text-muted g:text-[12px]">{t("settings.appearanceHint")}</span>
      </fieldset>
      </div>
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 g:gap-x-4 g:gap-y-3", G_GROUP_T)}>
        <label className={cn(LABEL, "g:max-w-sm")}>
          {t("settings.defaultLocation")}
          <select className={fieldCls} value={depot} onChange={(e) => setDepot(e.target.value)} aria-label={t("settings.defaultLocation")}>
            <option value="">{t("settings.allMyLocations")}</option>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted g:text-[12px]">{t("settings.defaultLocationHint")}</span>
        </label>
        <label className={cn(LABEL, "g:max-w-sm")}>
          {t("settings.toursOpensWith")}
          <select className={fieldCls} value={toursView} onChange={(e) => setToursView(e.target.value as typeof toursView)} aria-label={t("settings.toursOpensWith")}>
            <option value="day">{t("settings.toursView.day")}</option>
            <option value="all">{t("settings.toursView.all")}</option>
            <option value="archived">{t("settings.toursView.archived")}</option>
          </select>
        </label>
      </div>
      <div className={G_GROUP_T}>
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
    <label className={cn(LABEL, props.className)}>
      {label}
      <Input value={form[k]} disabled={!editable} dir={props.ltr ? "ltr" : undefined} type={props.type} placeholder={props.placeholder} maxLength={props.maxLength} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-label={label} />
    </label>
  );
  return (
    <Card className={cn("flex flex-col gap-5 p-5", G_FORM)}>
      <CardHeader className={cn("-mx-5 -mt-5", G_HEAD)} title={t("settings.section.company")} description={t("settings.companyDesc")} />
      {!editable && <ReadOnlyNote className="g:px-4 g:pt-3" />}
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 g:max-w-3xl g:gap-x-4 g:gap-y-3", G_GROUP)}>
        {field("name", t("settings.field.name"), { className: "sm:col-span-2", maxLength: 160 })}
        {field("contactEmail", t("settings.field.contactEmail"), { type: "email", ltr: true })}
        {field("contactPhone", t("settings.field.contactPhone"), { placeholder: "+49 …", ltr: true })}
        {field("addressStreet", t("settings.field.street"), { className: "sm:col-span-2" })}
        {field("addressPostalCode", t("settings.field.postalCode"), { ltr: true })}
        {field("addressCity", t("settings.field.city"))}
        {field("addressCountry", t("settings.field.country"), { maxLength: 2, ltr: true })}
        {field("website", t("settings.field.website"), { placeholder: "https://", ltr: true })}
      </div>
      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface-2 p-4 text-[13px] sm:grid-cols-3 g:rounded-none g:border-x-0 g:border-b-0 g:bg-transparent g:px-4 g:py-3.5">
        <div>
          <dt className={DT}>{t("settings.timeZone")}</dt>
          <dd className={DD}>{c.timeZone}</dd>
          <dd className="text-2xs text-muted g:text-[12px]">{t("settings.timeZoneHint")}</dd>
        </div>
        <div>
          <dt className={DT}>{t("settings.podRetention")}</dt>
          <dd className={DD}>{t("settings.days", { count: data.proofRetentionDays })}</dd>
        </div>
        <div>
          <dt className={DT}>{t("settings.plan")}</dt>
          <dd className={DD}>{data.subscription ? `${data.subscription.plan} · ${data.subscription.status}` : t("settings.planHidden")}</dd>
        </div>
      </dl>
      {editable && (
        <div className={G_GROUP_T}>
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
    <Card className={cn("flex flex-col gap-5 p-5", G_FORM)}>
      <CardHeader className={cn("-mx-5 -mt-5", G_HEAD)} title={t("settings.section.driverRules")} description={t("settings.rulesDesc")} />
      {!editable && <ReadOnlyNote className="g:px-4 g:pt-3" />}
      <div className={cn("flex flex-col gap-3", G_GROUP)}>
        <label className="flex items-start gap-3 text-[13px]">
          <Checkbox checked={phone} onCheckedChange={(c) => editable && setPhone(c === true)} label={t("settings.showPhone")} />
          <span>
            <span className="font-semibold text-ink g:font-medium">{t("settings.showPhone")}</span>
            <span className="block text-2xs text-muted g:text-[12px]">{t("settings.showPhoneHint")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-[13px]">
          <Checkbox checked={podLocation} onCheckedChange={(c) => editable && setPodLocation(c === true)} label={t("settings.podLocation")} />
          <span>
            <span className="font-semibold text-ink g:font-medium">{t("settings.podLocation")}</span>
            <span className="block text-2xs text-muted g:text-[12px]">{t("settings.podLocationHint")}</span>
          </span>
        </label>
      </div>
      <section aria-label={t("settings.failureReasons")} className={cn("flex flex-col gap-2", G_GROUP_T)}>
        <h3 className="text-[13px] font-semibold text-ink g:font-medium">{t("settings.reasonsTitle")}</h3>
        <p className="text-2xs text-muted g:text-[12px]">
          {r.customFailureReasons ? t("settings.reasonsOwn") : t("settings.reasonsStandard")} {t("settings.reasonsNoRemove")}
        </p>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line g:max-w-3xl g:rounded-md">
          {reasons.map((x, i) => (
            <li key={x.code} className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[180px_1fr_auto] g:gap-x-3 g:gap-y-1 g:py-1.5">
              <code className="text-2xs text-muted" dir="ltr">
                {x.code}
              </code>
              <Input value={x.label} disabled={!editable} placeholder={t("settings.labelPlaceholder")} maxLength={80} onChange={(e) => setReasons(reasons.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} aria-label={t("settings.labelFor", { code: x.code })} />
              <label className="flex items-center gap-2 text-2xs text-ink-2 g:text-[12px]">
                <Checkbox checked={!!x.requiresNote} onCheckedChange={(c) => editable && setReasons(reasons.map((y, j) => (j === i ? { ...y, requiresNote: c === true } : y)))} label={t("settings.noteRequiredFor", { code: x.code })} />
                {t("settings.noteRequired")}
              </label>
            </li>
          ))}
        </ul>
        {editable && reasons.length < 30 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className={LABEL}>
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
        <div className={cn("flex items-center gap-3", G_GROUP_T)}>
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
      <Card className={cn("flex flex-col gap-4 p-5", G_FORM)}>
        <CardHeader
          className={cn("-mx-5 -mt-5", G_HEAD)}
          title={t("settings.section.tracking")}
          description={t("settings.trackingDesc")}
          actions={
            <Button variant="secondary" size="icon-sm" onClick={() => void load()} aria-label={t("settings.refresh")}>
              <RefreshCw />
            </Button>
          }
        />
        {!admin && <ReadOnlyNote className="g:px-4 g:pt-3" />}
        <div className={G_GROUP}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 g:flex g:max-w-3xl g:flex-col g:gap-0 g:divide-y g:divide-line g:rounded-md g:border g:border-line" role="radiogroup" aria-label={t("settings.trackingMode")}>
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
                "g:flex-row g:flex-wrap g:items-center g:gap-x-3 g:gap-y-0.5 g:rounded-none g:border-0 g:bg-transparent g:px-3 g:py-2 g:enabled:hover:bg-[var(--hover)]",
                mode === m && "border-brand-500 bg-brand-50 g:bg-[var(--selected)]",
              )}
            >
              {/* G: a small radio mark instead of a highlighted card. */}
              <span className={cn("hidden size-3.5 shrink-0 items-center justify-center rounded-full border g:inline-flex", mode === m ? "border-brand-600" : "border-line-3")} aria-hidden="true">
                {mode === m && <span className="size-1.5 rounded-full bg-brand-600" />}
              </span>
              <span className={cn("text-[14px] font-bold text-ink g:shrink-0 g:text-[13px] g:font-medium sm:g:w-44", mode === m && "text-brand-700 g:text-ink")}>{modeLabel(m, t)}</span>
              <span className="text-2xs text-muted g:min-w-0 g:flex-1 g:text-[12px] max-sm:g:basis-full max-sm:g:ps-[26px]">{t(`settings.modeDesc.${m}`, { limit: tk.pilotLimit })}</span>
              {mode === m && <Badge tone="brand" className="g:text-muted">{t("settings.current")}</Badge>}
            </button>
          ))}
        </div>
        </div>
        <dl className={cn("grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4", G_GROUP_T)}>
          <div>
            <dt className={DT}>{t("settings.noticeVersion")}</dt>
            <dd className="font-semibold text-ink tabular g:font-medium">{tk.noticeVersion}</dd>
          </div>
          <div>
            <dt className={DT}>{t("settings.acknowledged")}</dt>
            <dd className="font-semibold text-ink tabular g:font-medium">{t("settings.acknowledgedValue", { ack: tk.acknowledgedCurrentNotice, count: tk.activeDrivers })}</dd>
          </div>
          <div>
            <dt className={DT}>{t("settings.positionInterval")}</dt>
            <dd className="font-semibold text-ink tabular g:font-medium">{t("common.sec", { n: tk.intervalSeconds })}</dd>
          </div>
          <div>
            <dt className={DT}>{t("settings.historyKept")}</dt>
            <dd className="font-semibold text-ink tabular g:font-medium">{t("settings.days", { count: tk.retentionDays })}</dd>
          </div>
        </dl>
        {admin && (
          <div className="g:-mt-1 g:px-4 g:pb-3.5">
            <Button variant="secondary" size="sm" onClick={() => setNoticeDialog(true)}>
              {t("settings.requireNewAck")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 g:min-h-11 g:gap-x-3 g:py-2">
          <h3 className="text-[15px] font-bold text-ink g:text-[13.5px] g:font-semibold">{t("settings.drivers")}</h3>
          {list && (
            <span className="text-2xs text-muted g:text-[12px]">
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
                  {admin && <th className="h-10 w-10 ps-4 g:h-9" aria-label={t("settings.select")} />}
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
        <p className="border-t border-line px-4 py-2.5 text-2xs text-muted g:py-2 g:text-[12px]">
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
  // G: status as a small dot + text; colour in the text only where action is needed (amber/red).
  const toneCls = { success: "bg-success-soft text-success-ink g:text-ink-2", warning: "bg-warning-soft text-warning-ink", danger: "bg-danger-soft text-danger-ink", neutral: "bg-surface-2 text-muted", info: "bg-info-soft text-info-ink g:text-ink-2" }[st.tone];
  const dotCls = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-subtle", info: "bg-info" }[st.tone];
  return (
    <tr className={cn("border-b border-line last:border-0 g:hover:bg-[var(--hover)]", selected && "g:bg-[var(--selected)] g:hover:bg-[var(--selected)]")}>
      {admin && (
        <td className="ps-4">
          <Checkbox checked={selected} onCheckedChange={onSelect} label={t("settings.selectName", { name: d.name })} />
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-ink g:font-medium">{d.name}</td>
      <td className="whitespace-nowrap px-3 text-ink-2">{d.depotName ?? "–"}</td>
      <td className="px-3">
        {admin ? (
          <button
            type="button"
            role="switch"
            aria-checked={d.pilot}
            aria-label={t("settings.pilotFor", { name: d.name })}
            onClick={() => onPilot(!d.pilot)}
            className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors g:h-[18px] g:w-[34px]", d.pilot ? "bg-brand-600" : "bg-surface-3")}
          >
            <span className={cn("inline-block size-5 rounded-full bg-white shadow-xs transition-transform g:size-3.5 g:shadow-none", d.pilot ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5")} />
          </button>
        ) : (
          <span className="text-ink-2">{d.pilot ? t("common.yes") : t("common.no")}</span>
        )}
      </td>
      <td className="px-3">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-bold g:bg-transparent g:px-0 g:py-0 g:text-[12.5px] g:font-normal", toneCls)} title={trackingStateExplain(d.state, t)}>
          {d.state === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current g:hidden" aria-hidden="true" />}
          <span className={cn("hidden size-1.5 shrink-0 rounded-full g:inline-block", dotCls)} aria-hidden="true" />
          {/* G: the label at body weight (the global G rule keeps font-bold at 600). */}
          <span className="g:font-normal">{trackingStateLabel(d.state, t)}</span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 text-2xs g:text-[12.5px]">
        {d.acknowledgedCurrent ? (
          <span className="text-success-ink g:text-ink-2">{t("settings.ackCurrent", { version: d.acknowledgedVersion, date: fmt.date(d.acknowledgedAt!, { dateStyle: "short" }) })}</span>
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
      {/* G: one bordered surface with two hairline-separated rows instead of two icon cards. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 g:flex g:flex-col g:gap-0 g:rounded-lg g:border g:border-line g:bg-surface">
        <Card className="flex flex-col gap-2 p-5 g:gap-1 g:rounded-none g:border-0 g:bg-transparent g:px-4 g:py-3">
          <ShieldCheck className="size-5 text-brand-600 g:hidden" />
          <h3 className="text-[15px] font-bold text-ink g:text-[13.5px] g:font-semibold">{t("settings.team")}</h3>
          <p className="text-[13px] text-ink-2 g:text-muted">{t("settings.teamDesc")}</p>
          {data.canEdit.team ? (
            <Link href="/fleet?tab=team" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:underline g:w-fit g:font-medium">
              {t("settings.openTeam")} <ExternalLink className="size-3.5 rtl:-scale-x-100" />
            </Link>
          ) : (
            <span className="text-2xs text-muted g:text-[12px]">{t("settings.managedByAdmins")}</span>
          )}
        </Card>
        <Card className="flex flex-col gap-2 p-5 g:gap-1 g:rounded-none g:border-x-0 g:border-b-0 g:border-t g:bg-transparent g:px-4 g:py-3">
          <MapPinned className="size-5 text-brand-600 g:hidden" />
          <h3 className="text-[15px] font-bold text-ink g:text-[13.5px] g:font-semibold">{t("settings.locations")}</h3>
          <p className="text-[13px] text-ink-2 g:text-muted">{t("settings.locationsDesc")}</p>
          <Link href="/fleet?tab=depots" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:underline g:w-fit g:font-medium">
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
                <th className="h-10 ps-5 text-start g:h-9 g:ps-4">{t("settings.permission")}</th>
                {roles.map((r) => (
                  <th key={r} className="px-3 text-center">
                    {roleLabel(r, t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KEY_PERMISSIONS.map((p) => (
                <tr key={p} className="border-b border-line last:border-0 g:hover:bg-[var(--hover)]">
                  <td className="py-2 ps-5 text-ink-2 g:ps-4">{t(`settings.perm.${p}`)}</td>
                  {roles.map((r) => (
                    <td key={r} className="px-3 text-center">
                      {data.roles[r]!.includes(p) ? <span className="font-bold text-success-ink g:font-medium g:text-ink-2" aria-label={t("settings.ariaYes")}>✓</span> : <span className="text-subtle" aria-label={t("settings.ariaNo")}>–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="flex items-center gap-1.5 text-2xs text-muted g:text-[12px]">
        <Settings2 className="size-3.5" /> {t("settings.rolesEnforced")}
      </p>
    </div>
  );
}
