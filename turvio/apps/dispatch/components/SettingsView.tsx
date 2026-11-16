"use client";

import { can } from "@turvio/shared";
import { Badge, Button, Card, CardHeader, Checkbox, Dialog, Input, Skeleton, THEME_KEY, cn, toast, useTheme } from "@turvio/web-ui/ds";
import { Building2, ExternalLink, Loader2, Lock, MapPinned, Plus, Radio, RefreshCw, Settings2, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { fieldCls } from "../lib/helpers";
import { MODE_LABEL, TRACKING_STATE, settingsApi, type CompanySettings, type DriverTracking, type Preferences, type TrackingDrivers, type TrackingMode } from "../lib/settings";
import { ageLabel } from "../lib/live";
import { useDispatch } from "../lib/store";

type Section = "preferences" | "company" | "driver-rules" | "tracking" | "team";

/**
 * Settings: personal preferences (every user) and company settings (read by staff, changed by
 * company admins – the API enforces the same rules and asks for the second factor).
 */
export function SettingsView() {
  const { session } = useDispatch();
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
    { key: "preferences", label: "My preferences", icon: <UserRound />, show: true },
    { key: "company", label: "Company", icon: <Building2 />, show: true },
    { key: "driver-rules", label: "Driver app rules", icon: <Smartphone />, show: true },
    { key: "tracking", label: "Live tracking", icon: <Radio />, show: seesTracking },
    { key: "team", label: "Team & roles", icon: <ShieldCheck />, show: true },
  ];
  const visible = sections.filter((s) => s.show);
  const raw = params?.get("section") as Section | null;
  const section: Section = visible.some((s) => s.key === raw) ? raw! : "preferences";
  const go = (s: Section) => router.replace(`${pathname ?? "/settings"}?section=${s}`, { scroll: false });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">Settings</h1>
        <p className="text-sm text-ink-2">
          Your own preferences, and {session.organizationName}&apos;s settings.{" "}
          {overview && !overview.canEdit.company && <span className="text-muted">Company settings are shown read-only – company administrators change them.</span>}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
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
  return (
    <p className="flex items-center gap-1.5 text-2xs text-muted">
      <Lock className="size-3.5" /> Read-only for your role.
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
  useEffect(() => {
    api.preferences().then(
      (p) => {
        setPrefs(p);
        setThemeChoice(p.theme);
        const d = p.orgDefaults[session.organizationId];
        setDepot(d?.defaultDepotId ?? "");
        setToursView(d?.toursView ?? "day");
      },
      (e) => toast.error("Preferences not loaded", { description: errorMessage(e) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.organizationId]);
  const applyTheme = (t: Preferences["theme"]) => {
    if (t === "system") {
      try {
        localStorage.removeItem(THEME_KEY);
      } catch {
        /* private mode */
      }
      document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } else setTheme(t);
  };
  const save = async () => {
    setBusy(true);
    try {
      const p = await api.savePreferences({ theme, orgDefaults: { [session.organizationId]: { defaultDepotId: depot || null, toursView } } });
      setPrefs(p);
      applyTheme(theme);
      if (depot) setDepotId(depot);
      toast.success("Preferences saved", { description: "Stored with your account – they apply on every computer you sign in on." });
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  if (!prefs) return <Skeleton className="h-64" />;
  return (
    <Card className="flex flex-col gap-5 p-5">
      <CardHeader className="-mx-5 -mt-5" title="My preferences" description="Personal – they never change anything for your colleagues." />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-ink">Appearance</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Appearance">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => {
                setThemeChoice(t);
                applyTheme(t);
              }}
              className={cn("h-10 rounded-xl border border-line px-4 text-[13px] font-semibold text-ink-2 hover:border-line-strong", theme === t && "border-brand-500 bg-brand-50 text-brand-700")}
            >
              {t === "system" ? "Follow system" : t === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
        <span className="text-2xs text-muted">The switch in the top bar changes it for this browser too.</span>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Default location
          <select className={fieldCls} value={depot} onChange={(e) => setDepot(e.target.value)} aria-label="Default location">
            <option value="">All my locations</option>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted">Selected when Dispatch opens.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Tours page opens with
          <select className={fieldCls} value={toursView} onChange={(e) => setToursView(e.target.value as typeof toursView)} aria-label="Tours page opens with">
            <option value="day">Day board</option>
            <option value="all">All tours</option>
            <option value="archived">Archive</option>
          </select>
        </label>
      </div>
      <div>
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Save preferences
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- company
function CompanySection({ data, onSaved }: { data: CompanySettings; onSaved: () => void }) {
  const { session } = useDispatch();
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
      toast.success("Company details saved", { description: "The change is recorded in the audit log." });
      onSaved();
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const field = (k: keyof typeof form, label: string, props: { type?: string; placeholder?: string; className?: string; maxLength?: number } = {}) => (
    <label className={cn("flex flex-col gap-1.5 text-[13px] font-medium text-ink-2", props.className)}>
      {label}
      <Input value={form[k]} disabled={!editable} type={props.type} placeholder={props.placeholder} maxLength={props.maxLength} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-label={label} />
    </label>
  );
  return (
    <Card className="flex flex-col gap-5 p-5">
      <CardHeader className="-mx-5 -mt-5" title="Company" description="Shown to your own staff. Changes are recorded with your name." />
      {!editable && <ReadOnlyNote />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("name", "Company name", { className: "sm:col-span-2", maxLength: 160 })}
        {field("contactEmail", "Contact e-mail", { type: "email" })}
        {field("contactPhone", "Contact phone", { placeholder: "+49 …" })}
        {field("addressStreet", "Street and number", { className: "sm:col-span-2" })}
        {field("addressPostalCode", "Postal code")}
        {field("addressCity", "City")}
        {field("addressCountry", "Country (ISO code)", { maxLength: 2 })}
        {field("website", "Website", { placeholder: "https://" })}
      </div>
      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface-2 p-4 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Time zone</dt>
          <dd className="font-semibold text-ink">{c.timeZone}</dd>
          <dd className="text-2xs text-muted">Sets the company day for tours and reports.</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Proof-of-delivery retention</dt>
          <dd className="font-semibold text-ink">{data.proofRetentionDays} days</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Plan</dt>
          <dd className="font-semibold text-ink">{data.subscription ? `${data.subscription.plan} · ${data.subscription.status}` : "Visible to company administrators"}</dd>
        </div>
      </dl>
      {editable && (
        <div>
          <Button variant="primary" onClick={() => void save()} disabled={busy || Object.keys(changed).length === 0 || !form.name.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            Save company details
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
      toast.success("Driver app rules saved", { description: "Drivers get them with their next sync." });
      onSaved();
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-col gap-5 p-5">
      <CardHeader className="-mx-5 -mt-5" title="Driver app rules" description="What the TURVIO Driver app asks for and shows. Drivers receive changes with their next sync." />
      {!editable && <ReadOnlyNote />}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-[13px]">
          <Checkbox checked={phone} onCheckedChange={(c) => editable && setPhone(c === true)} label="Show recipient phone numbers to drivers" />
          <span>
            <span className="font-semibold text-ink">Show recipient phone numbers to drivers</span>
            <span className="block text-2xs text-muted">Only when your contract with the sender allows passing them on.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-[13px]">
          <Checkbox checked={podLocation} onCheckedChange={(c) => editable && setPodLocation(c === true)} label="Store the device position with proofs of delivery" />
          <span>
            <span className="font-semibold text-ink">Store the device position with proofs of delivery</span>
            <span className="block text-2xs text-muted">Personal data of your drivers: switch on only with a privacy impact assessment and, where one exists, the works council&apos;s agreement.</span>
          </span>
        </label>
      </div>
      <section aria-label="Failure reasons" className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-ink">Reasons a delivery did not happen</h3>
        <p className="text-2xs text-muted">
          {r.customFailureReasons ? "Your company's own list." : "TURVIO's standard list – saving makes it your own."} Existing reasons cannot be removed: phones that were
          offline may still report them, and those reports must not be refused.
        </p>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {reasons.map((x, i) => (
            <li key={x.code} className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[180px_1fr_auto]">
              <code className="text-2xs text-muted">{x.code}</code>
              <Input value={x.label} disabled={!editable} placeholder="Label shown to drivers (optional)" maxLength={80} onChange={(e) => setReasons(reasons.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} aria-label={`Label for ${x.code}`} />
              <label className="flex items-center gap-2 text-2xs text-ink-2">
                <Checkbox checked={!!x.requiresNote} onCheckedChange={(c) => editable && setReasons(reasons.map((y, j) => (j === i ? { ...y, requiresNote: c === true } : y)))} label={`Note required for ${x.code}`} />
                Note required
              </label>
            </li>
          ))}
        </ul>
        {editable && reasons.length < 30 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
              New reason
              <Input value={newLabel} maxLength={80} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Parcel damaged" aria-label="New reason" className="w-64" />
            </label>
            <Button
              variant="secondary"
              disabled={newCode.length < 2 || reasons.some((x) => x.code === newCode)}
              onClick={() => {
                setReasons([...reasons, { code: newCode, label: newLabel.trim(), requiresNote: false }]);
                setNewLabel("");
              }}
            >
              <Plus /> Add reason
            </Button>
            {newCode.length >= 2 && <span className="pb-2 text-2xs text-muted">code: {newCode}</span>}
          </div>
        )}
      </section>
      {editable && (
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Save driver app rules
          </Button>
          {reasons.some((x) => !known.has(x.code)) && <span className="text-2xs text-muted">{reasons.filter((x) => !known.has(x.code)).length} new reason(s) not saved yet</span>}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- live tracking administration
function TrackingSection({ data, onChanged }: { data: CompanySettings; onChanged: () => void }) {
  const { session } = useDispatch();
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
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);
  const refreshAll = () => {
    void load();
    onChanged();
  };
  const t = data.tracking;
  const mode = list?.mode ?? t.mode;
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
          title="Live tracking"
          description="Where drivers' phones send positions while a tour is driven. Positions are only recorded after the driver acknowledged the tracking notice."
          actions={
            <Button variant="secondary" size="icon-sm" onClick={() => void load()} aria-label="Refresh">
              <RefreshCw />
            </Button>
          }
        />
        {!admin && <ReadOnlyNote />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tracking mode">
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
              <span className={cn("text-[14px] font-bold text-ink", mode === m && "text-brand-700")}>{MODE_LABEL[m]}</span>
              <span className="text-2xs text-muted">
                {m === "off" ? "Nobody is tracked." : m === "pilot" ? `Only named pilot drivers (max. ${t.pilotLimit}) who agreed to test it.` : "Every driver who acknowledged the notice, while driving a tour."}
              </span>
              {mode === m && <Badge tone="brand">Current</Badge>}
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Notice version</dt>
            <dd className="font-semibold text-ink tabular">{t.noticeVersion}</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Acknowledged</dt>
            <dd className="font-semibold text-ink tabular">
              {t.acknowledgedCurrentNotice} of {t.activeDrivers} drivers
            </dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">Position interval</dt>
            <dd className="font-semibold text-ink tabular">{t.intervalSeconds} s</dd>
          </div>
          <div>
            <dt className="text-2xs uppercase tracking-[0.08em] text-muted">History kept</dt>
            <dd className="font-semibold text-ink tabular">{t.retentionDays} days</dd>
          </div>
        </dl>
        {admin && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setNoticeDialog(true)}>
              Require a new acknowledgement…
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h3 className="text-[15px] font-bold text-ink">Drivers</h3>
          {list && (
            <span className="text-2xs text-muted">
              {Object.entries(list.summary)
                .map(([k, n]) => `${n} ${TRACKING_STATE[k as keyof typeof TRACKING_STATE].label.toLowerCase()}`)
                .join(" · ")}{" "}
              · a position older than {Math.round(list.staleAfterSeconds / 60)} min is not current
            </span>
          )}
          {admin && selected.size > 0 && (
            <div className="ms-auto flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setPilotDialog({ ids: [...selected], enabled: true })}>
                Add {selected.size} to pilot
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPilotDialog({ ids: [...selected], enabled: false })}>
                Remove {selected.size} from pilot
              </Button>
            </div>
          )}
        </div>
        {error && <p className="px-4 py-4 text-[13px] text-danger-ink">{error}</p>}
        {!list && !error && <Skeleton className="m-4 h-40" />}
        {list && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]" aria-label="Driver tracking status">
              <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                <tr className="border-b border-line">
                  {admin && <th className="h-10 w-10 ps-4" aria-label="Select" />}
                  <th className="px-3 text-start">Driver</th>
                  <th className="px-3 text-start">Location</th>
                  <th className="px-3 text-start">Pilot</th>
                  <th className="px-3 text-start">Status</th>
                  <th className="px-3 text-start">Notice</th>
                  <th className="px-3 text-start">Active tour</th>
                  <th className="pe-4 ps-3 text-start">Last position</th>
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
          This list never shows where a driver is. Positions are visible only on the live map, for tours being driven. The phone&apos;s location permission is shown once the next
          driver app version reports it.
        </p>
      </Card>

      {modeDialog && <ModeDialog to={modeDialog} drivers={list?.drivers ?? []} pilotLimit={t.pilotLimit} onClose={() => setModeDialog(null)} onDone={refreshAll} />}
      {pilotDialog && <PilotDialog {...pilotDialog} names={(list?.drivers ?? []).filter((d) => pilotDialog.ids.includes(d.driverId)).map((d) => d.name)} onClose={() => setPilotDialog(null)} onDone={() => (setSelected(new Set()), refreshAll())} />}
      {noticeDialog && (
        <SimpleConfirm
          title="Require a new acknowledgement?"
          body="Use this when the tracking notice text changed. Every driver must read and confirm the notice again; until then their phone records no positions."
          label="Require new acknowledgement"
          onClose={() => setNoticeDialog(false)}
          run={async () => {
            await api.setTracking({ newNoticeVersion: true });
            toast.success("New notice version – drivers confirm it at their next app start");
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function DriverRow({ d, admin, noticeVersion, selected, onSelect, onPilot }: { d: DriverTracking; admin: boolean; noticeVersion: number; selected: boolean; onSelect: () => void; onPilot: (on: boolean) => void }) {
  const st = TRACKING_STATE[d.state];
  const toneCls = { success: "bg-success-soft text-success-ink", warning: "bg-warning-soft text-warning-ink", danger: "bg-danger-soft text-danger-ink", neutral: "bg-surface-2 text-muted", info: "bg-info-soft text-info-ink" }[st.tone];
  return (
    <tr className="border-b border-line last:border-0">
      {admin && (
        <td className="ps-4">
          <Checkbox checked={selected} onCheckedChange={onSelect} label={`Select ${d.name}`} />
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
            aria-label={`Pilot tracking for ${d.name}`}
            onClick={() => onPilot(!d.pilot)}
            className={cn("relative inline-flex h-6 w-10 items-center rounded-full transition-colors", d.pilot ? "bg-brand-600" : "bg-surface-3")}
          >
            <span className={cn("inline-block size-5 rounded-full bg-white shadow-xs transition-transform", d.pilot ? "translate-x-[18px]" : "translate-x-0.5")} />
          </button>
        ) : (
          <span className="text-ink-2">{d.pilot ? "Yes" : "No"}</span>
        )}
      </td>
      <td className="px-3">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-bold", toneCls)} title={st.explain}>
          {d.state === "live" && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
          {st.label}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 text-2xs">
        {d.acknowledgedCurrent ? (
          <span className="text-success-ink">v{d.acknowledgedVersion} · {new Date(d.acknowledgedAt!).toLocaleDateString("de-DE")}</span>
        ) : d.acknowledgedVersion ? (
          <span className="text-warning-ink">v{d.acknowledgedVersion} – v{noticeVersion} pending</span>
        ) : (
          <span className="text-muted">Not acknowledged</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 text-ink-2">{d.currentTour ? `${d.currentTour.name}${d.currentTour.status === "paused" ? " (paused)" : ""}` : "–"}</td>
      <td className="whitespace-nowrap pe-4 ps-3 text-ink-2 tabular">{d.positionAgeSeconds !== null ? ageLabel(d.positionAgeSeconds) : "–"}</td>
    </tr>
  );
}

function SimpleConfirm({ title, body, label, onClose, run, disabled, children }: { title: string; body: ReactNode; label: string; onClose: () => void; run: () => Promise<void>; disabled?: boolean; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
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
                toast.error("Not changed", { description: errorMessage(e) });
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
  const pilots = drivers.filter((d) => d.pilot);
  const [confirmed, setConfirmed] = useState(false);
  const body =
    to === "off" ? (
      <p>Drivers&apos; phones stop sending positions. Recorded history stays until its retention ends.</p>
    ) : to === "pilot" ? (
      pilots.length === 0 ? (
        <p className="text-warning-ink">No pilot drivers yet. Switch on pilot tracking for the drivers who agreed to test it in the list below first.</p>
      ) : (
        <p>
          Only these {pilots.length} pilot driver(s) are tracked (after acknowledging the notice): {pilots.map((p) => p.name).join(", ")}. Max. {pilotLimit}.
        </p>
      )
    ) : (
      <p>Every driver who acknowledged the tracking notice is tracked while driving a tour. Drivers who have not acknowledged it are not tracked.</p>
    );
  const needs = to === "pilot" ? "Each pilot driver agreed to be tracked for testing and has read the notice." : to === "active_tours" ? "The privacy impact assessment is done, the works council agreed (§ 87 (1) no. 6 BetrVG) where one exists, and all drivers were informed." : null;
  return (
    <SimpleConfirm
      title={`Switch live tracking to “${MODE_LABEL[to]}”?`}
      body={body}
      label="Switch"
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
        toast.success(`Live tracking: ${MODE_LABEL[to]}`, { description: "Recorded with your name and the time." });
        onDone();
      }}
    >
      {needs && (
        <label className="flex items-start gap-2">
          <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} label="I confirm the prerequisites" />
          <span>{needs}</span>
        </label>
      )}
      <p className="text-2xs text-muted">Acknowledging the notice informs drivers; it does not replace any consent or employment-law process your company needs.</p>
    </SimpleConfirm>
  );
}

function PilotDialog({ ids, enabled, names, onClose, onDone }: { ids: string[]; enabled: boolean; names: string[]; onClose: () => void; onDone: () => void }) {
  const { session } = useDispatch();
  const [confirmed, setConfirmed] = useState(!enabled);
  return (
    <SimpleConfirm
      title={enabled ? `Add ${ids.length} driver(s) to pilot tracking?` : `Remove ${ids.length} driver(s) from pilot tracking?`}
      body={<p>{names.join(", ")}</p>}
      label={enabled ? "Add to pilot" : "Remove from pilot"}
      onClose={onClose}
      disabled={!confirmed}
      run={async () => {
        const r = await settingsApi(session.organizationId).setPilots(ids, enabled);
        toast.success(`${r.changed} driver(s) changed · ${r.pilots} pilot(s) now`);
        onDone();
      }}
    >
      {enabled && (
        <label className="flex items-start gap-2">
          <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} label="Each driver agreed" />
          <span>Each of them agreed to be tracked for testing and has read the tracking notice. In pilot mode they are tracked only after acknowledging it in the app.</span>
        </label>
      )}
    </SimpleConfirm>
  );
}

// ---------------------------------------------------------------- team & roles
const KEY_PERMISSIONS: [string, string][] = [
  ["tours.manage", "Plan and edit tours"],
  ["tours.close", "Finish / cancel tours"],
  ["tours.archive", "Archive / restore"],
  ["tours.delete", "Delete eligible tours"],
  ["tracking.view_live", "See the live map"],
  ["reports.view", "Analytics"],
  ["reports.export", "Export reports"],
  ["org.members.manage", "Manage the team"],
  ["org.settings.manage", "Company settings and live tracking"],
];

function TeamSection({ data }: { data: CompanySettings }) {
  const roles = ["owner", "admin", "dispatcher", "driver"].filter((r) => data.roles[r]);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-2 p-5">
          <ShieldCheck className="size-5 text-brand-600" />
          <h3 className="text-[15px] font-bold text-ink">Team</h3>
          <p className="text-[13px] text-ink-2">Invite colleagues, change roles and the locations each one may work in.</p>
          {data.canEdit.team ? (
            <Link href="/fleet?tab=team" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:underline">
              Open Team <ExternalLink className="size-3.5" />
            </Link>
          ) : (
            <span className="text-2xs text-muted">Managed by company administrators.</span>
          )}
        </Card>
        <Card className="flex flex-col gap-2 p-5">
          <MapPinned className="size-5 text-brand-600" />
          <h3 className="text-[15px] font-bold text-ink">Locations</h3>
          <p className="text-[13px] text-ink-2">Depot addresses and opening hours used for planning and routing.</p>
          <Link href="/fleet?tab=depots" className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:underline">
            Open Locations <ExternalLink className="size-3.5" />
          </Link>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="What each role may do" description={`Your role: ${data.yourRole}. Dispatchers and managers work only in the locations assigned to them.`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]" aria-label="Role permissions">
            <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
              <tr className="border-b border-line">
                <th className="h-10 ps-5 text-start">Permission</th>
                {roles.map((r) => (
                  <th key={r} className="px-3 text-center capitalize">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KEY_PERMISSIONS.map(([p, label]) => (
                <tr key={p} className="border-b border-line last:border-0">
                  <td className="py-2 ps-5 text-ink-2">{label}</td>
                  {roles.map((r) => (
                    <td key={r} className="px-3 text-center">
                      {data.roles[r]!.includes(p) ? <span className="font-bold text-success-ink" aria-label="yes">✓</span> : <span className="text-subtle" aria-label="no">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="flex items-center gap-1.5 text-2xs text-muted">
        <Settings2 className="size-3.5" /> Roles are enforced by the server and the database, not only by what Dispatch shows.
      </p>
    </div>
  );
}
