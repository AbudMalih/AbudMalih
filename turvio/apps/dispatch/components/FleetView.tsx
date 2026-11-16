"use client";

import { can, type Depot, type Driver, type Vehicle } from "@turvio/shared";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, cn, toast } from "@turvio/web-ui/ds";
import { Ellipsis, Loader2, Mail, Plus, Truck, UserPlus, Users, Warehouse } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../lib/api";
import { useDispatch } from "../lib/store";
import { memberScopeLabel } from "../lib/helpers";
import { useI18n, useT } from "../lib/i18n/client";
import { roleLabel } from "./DispatchShell";

type Tab = "drivers" | "vehicles" | "depots" | "team";
const TABS: readonly Tab[] = ["drivers", "vehicles", "depots", "team"];
const inputCls =
  "h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:border-line-3 focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none g:h-8 g:rounded-md g:border-line-2 g:bg-surface-2 g:px-2.5 g:text-[13px] g:font-normal g:focus:border-brand-600";

function F({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-[13px] font-medium text-ink-2 g:text-[12px] g:font-normal g:text-muted", className)}>
      {label}
      {children}
    </label>
  );
}

function FormDialog({ open, onOpenChange, title, submitLabel, onSubmit, valid = true, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; submitLabel: string; onSubmit: () => Promise<void>; valid?: boolean; children: ReactNode }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !valid}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit();
                onOpenChange(false);
              } catch (e) {
                toast.error(t("fleet.notSaved"), { description: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 g:gap-x-3 g:gap-y-2.5">{children}</div>
    </Dialog>
  );
}

type DriverRow = Driver & { userId?: string | null };
type VehicleRow = Vehicle & { active?: boolean };

function DriverDialog({ driver, open, onOpenChange, depots, onSaved }: { driver: DriverRow | null; open: boolean; onOpenChange: (o: boolean) => void; depots: Depot[]; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
  const t = useT();
  const [name, setName] = useState(driver?.displayName ?? "");
  const [depot, setDepot] = useState(driver?.depotId ?? depots[0]?.id ?? "");
  const [shift, setShift] = useState(String((driver?.maxShiftMinutes ?? 480) / 60));
  useEffect(() => {
    if (open) {
      setName(driver?.displayName ?? "");
      setDepot(driver?.depotId || depots[0]?.id || "");
      setShift(String((driver?.maxShiftMinutes ?? 480) / 60));
    }
  }, [open, driver, depots]);
  const hours = Number(shift);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={driver ? t("fleet.editName", { name: driver.displayName }) : t("fleet.addDriver")}
      submitLabel={driver ? t("common.save") : t("fleet.addDriver")}
      valid={!!name.trim() && hours >= 1 && hours <= 10}
      onSubmit={async () => {
        const body = { displayName: name.trim(), depotId: depot || null, maxShiftMinutes: Math.round(hours * 60), active: driver?.active ?? true };
        if (driver) await api("PATCH", `/v1/orgs/${session.organizationId}/drivers/${driver.id}`, body);
        else await api("POST", `/v1/orgs/${session.organizationId}/drivers`, body);
        toast.success(driver ? t("fleet.driverUpdated") : t("fleet.nameAdded", { name: body.displayName }));
        await onSaved();
      }}
    >
      <F label={t("fleet.name")} className="sm:col-span-2">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </F>
      <F label={t("fleet.depot")}>
        <select className={inputCls} value={depot} onChange={(e) => setDepot(e.target.value)}>
          {depots.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </F>
      <F label={t("fleet.maxShiftHours")}>
        <input className={inputCls} type="number" min={1} max={10} step={0.5} value={shift} onChange={(e) => setShift(e.target.value)} />
      </F>
    </FormDialog>
  );
}

function VehicleDialog({ vehicle, open, onOpenChange, depots, onSaved }: { vehicle: VehicleRow | null; open: boolean; onOpenChange: (o: boolean) => void; depots: Depot[]; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
  const t = useT();
  const [label, setLabel] = useState("");
  const [plate, setPlate] = useState("");
  const [depot, setDepot] = useState("");
  const [cap, setCap] = useState("");
  useEffect(() => {
    if (open) {
      setLabel(vehicle?.label ?? "");
      setPlate(vehicle?.licensePlate ?? "");
      setDepot(vehicle?.depotId || depots[0]?.id || "");
      setCap(vehicle?.capacityParcels ? String(vehicle.capacityParcels) : "");
    }
  }, [open, vehicle, depots]);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={vehicle ? t("fleet.editName", { name: vehicle.label }) : t("fleet.addVehicle")}
      submitLabel={vehicle ? t("common.save") : t("fleet.addVehicle")}
      valid={!!label.trim() && !!plate.trim() && (!cap || Number(cap) > 0)}
      onSubmit={async () => {
        const body = { label: label.trim(), licensePlate: plate.trim(), depotId: depot || null, capacityParcels: cap ? Number(cap) : null, active: vehicle?.active ?? true };
        if (vehicle) await api("PATCH", `/v1/orgs/${session.organizationId}/vehicles/${vehicle.id}`, body);
        else await api("POST", `/v1/orgs/${session.organizationId}/vehicles`, body);
        toast.success(vehicle ? t("fleet.vehicleUpdated") : t("fleet.nameAdded", { name: body.label }));
        await onSaved();
      }}
    >
      <F label={t("fleet.name")}>
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sprinter 5" />
      </F>
      <F label={t("fleet.licencePlate")}>
        <input className={inputCls} dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="H-JL 105" />
      </F>
      <F label={t("fleet.depot")}>
        <select className={inputCls} value={depot} onChange={(e) => setDepot(e.target.value)}>
          {depots.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </F>
      <F label={t("fleet.capacityOptional")}>
        <input className={inputCls} type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} />
      </F>
    </FormDialog>
  );
}

function DepotDialog({ depot, open, onOpenChange, onSaved }: { depot: Depot | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
  const t = useT();
  const [f, setF] = useState({ name: "", street: "", no: "", postal: "", city: "", lat: "", lng: "" });
  useEffect(() => {
    if (open)
      setF({
        name: depot?.name ?? "",
        street: depot?.address.street ?? "",
        no: depot?.address.houseNumber ?? "",
        postal: depot?.address.postalCode ?? "",
        city: depot?.address.city ?? "",
        lat: depot ? String(depot.location.lat) : "",
        lng: depot ? String(depot.location.lng) : "",
      });
  }, [open, depot]);
  const lat = Number(f.lat.replace(",", "."));
  const lng = Number(f.lng.replace(",", "."));
  const valid = !!f.name && !!f.street && !!f.postal && !!f.city && Number.isFinite(lat) && Number.isFinite(lng) && f.lat !== "" && f.lng !== "";
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={depot ? t("fleet.editDepot", { name: depot.name }) : t("fleet.addDepot")}
      submitLabel={depot ? t("common.save") : t("fleet.addDepot")}
      valid={valid}
      onSubmit={async () => {
        const body = { name: f.name, street: f.street, houseNumber: f.no || undefined, postalCode: f.postal, city: f.city, lat, lng };
        if (depot) await api("PATCH", `/v1/orgs/${session.organizationId}/depots/${depot.id}`, body);
        else await api("POST", `/v1/orgs/${session.organizationId}/depots`, body);
        toast.success(depot ? t("fleet.depotUpdated") : t("fleet.depotAdded", { name: f.name }));
        await onSaved();
      }}
    >
      <F label={t("fleet.name")} className="sm:col-span-2">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </F>
      <F label={t("fleet.street")}>
        <input className={inputCls} value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} />
      </F>
      <F label={t("fleet.houseNo")}>
        <input className={inputCls} value={f.no} onChange={(e) => setF({ ...f, no: e.target.value })} />
      </F>
      <F label={t("fleet.postcode")}>
        <input className={inputCls} dir="ltr" value={f.postal} onChange={(e) => setF({ ...f, postal: e.target.value })} />
      </F>
      <F label={t("fleet.city")}>
        <input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </F>
      <F label={t("fleet.latitude")}>
        <input className={inputCls} dir="ltr" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} inputMode="decimal" />
      </F>
      <F label={t("fleet.longitude")}>
        <input className={inputCls} dir="ltr" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} inputMode="decimal" />
      </F>
    </FormDialog>
  );
}

function InviteDialog({ open, onOpenChange, driver, depots, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; driver: DriverRow | null; depots: Depot[]; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "dispatcher" | "owner">("dispatcher");
  const [scope, setScope] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState(false);
  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("dispatcher");
      setScope([]);
      setAllLocations(false);
    }
  }, [open]);
  // A dispatcher needs at least one location (or all locations): no location = no access.
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (!!driver || role !== "dispatcher" || allLocations || scope.length > 0);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={driver ? t("fleet.inviteDriverTitle", { name: driver.displayName }) : t("fleet.inviteMemberTitle")}
      submitLabel={t("fleet.sendInvitation")}
      valid={valid}
      onSubmit={async () => {
        await api("POST", `/v1/orgs/${session.organizationId}/invitations`, driver ? { email, role: "driver", driverId: driver.id } : role === "dispatcher" ? { email, role, allLocations, depotIds: allLocations ? null : scope } : { email, role });
        toast.success(t("fleet.invitationSent", { email }), { description: t("fleet.invitationValid") });
        await onSaved();
      }}
    >
      <F label={t("fleet.email")} className="sm:col-span-2">
        <input className={inputCls} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </F>
      {!driver && (
        <>
          <F label={t("fleet.role")}>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="dispatcher">{t("common.role.dispatcher")}</option>
              <option value="admin">{t("common.role.admin")}</option>
              {session.role === "owner" && <option value="owner">{t("common.role.owner")}</option>}
            </select>
          </F>
          {role === "dispatcher" && (
            <fieldset className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 sm:col-span-2 g:gap-1.5 g:text-[12px] g:font-normal g:text-muted">
              <legend className="mb-1">{t("fleet.scopeLegend")}</legend>
              <label className="inline-flex items-center gap-1.5 font-normal g:text-[13px] g:text-ink">
                <input type="checkbox" className="accent-[var(--violet)]" checked={allLocations} onChange={(e) => setAllLocations(e.target.checked)} />
                {t("fleet.allLocationsCompanyWide")}
              </label>
              <div className="flex flex-wrap gap-2">
                {!allLocations && depots.map((d) => (
                  <label key={d.id} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-normal g:h-7 g:border-line-2 g:py-0 g:text-[13px] g:text-ink">
                    <input type="checkbox" className="accent-[var(--violet)]" checked={scope.includes(d.id)} onChange={(e) => setScope(e.target.checked ? [...scope, d.id] : scope.filter((x) => x !== d.id))} />
                    {d.name}
                  </label>
                ))}
              </div>
              {!allLocations && !scope.length && <p className="text-xs font-normal text-muted g:text-[12px]">{t("fleet.chooseLocation")}</p>}
            </fieldset>
          )}
        </>
      )}
      {driver && <p className="text-xs text-muted sm:col-span-2 g:text-[12px]">{t("fleet.driverInviteHint", { name: driver.displayName })}</p>}
    </FormDialog>
  );
}

interface TeamData {
  members: { membershipId: string; email: string; role: string; active: boolean; depotIds: string[] | null; allLocations?: boolean; driverId: string | null }[];
  invitations: { id: string; email: string; role: string; expiresAt: string }[];
}

export function FleetView() {
  const { scoped, session, reload } = useDispatch();
  const { t, fmt } = useI18n();
  // The section lives in the URL (?tab=), so the sidebar's Drivers/Vehicles/Locations/Team entries link to it.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = params?.get("tab");
  const tab: Tab = TABS.includes(fromUrl as Tab) ? (fromUrl as Tab) : "drivers";
  const setTab = useCallback((k: Tab) => router.replace(`${pathname ?? "/fleet"}?tab=${k}`, { scroll: false }), [router, pathname]);
  const [vehicles, setVehicles] = useState<VehicleRow[] | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [dialog, setDialog] = useState<null | { kind: "driver" | "vehicle" | "depot" | "invite"; item?: unknown }>(null);
  const org = session.organizationId;
  const isAdmin = can(session.role, "org.members.manage");
  const canDepots = can(session.role, "depots.manage");

  const loadVehicles = useCallback(() => api<VehicleRow[]>("GET", `/v1/orgs/${org}/vehicles`).then(setVehicles), [org]);
  const loadTeam = useCallback(() => (isAdmin ? api<TeamData>("GET", `/v1/orgs/${org}/members`).then(setTeam) : Promise.resolve()), [org, isAdmin]);
  useEffect(() => {
    loadVehicles().catch((e) => toast.error(t("fleet.vehiclesNotLoaded"), { description: errorMessage(e) }));
    loadTeam().catch((e) => toast.error(t("fleet.teamNotLoaded"), { description: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVehicles, loadTeam]);
  const refreshAll = async () => {
    await Promise.all([reload(), loadVehicles(), loadTeam()]);
  };
  const depotName = (id: string | null | undefined) => scoped.depots.find((d) => d.id === id)?.name ?? "–";
  const drivers = scoped.drivers as DriverRow[];

  const tabs: { key: Tab; label: string; icon: ReactNode; count?: number; show: boolean }[] = [
    { key: "drivers", label: t("fleet.tab.drivers"), icon: <Users />, count: drivers.length, show: true },
    { key: "vehicles", label: t("fleet.tab.vehicles"), icon: <Truck />, count: vehicles?.length, show: true },
    { key: "depots", label: t("fleet.tab.depots"), icon: <Warehouse />, count: scoped.depots.length, show: true },
    { key: "team", label: t("fleet.tab.team"), icon: <UserPlus />, count: team?.members.length, show: isAdmin },
  ];

  const toggleDriver = async (d: DriverRow) => {
    try {
      await api("PATCH", `/v1/orgs/${org}/drivers/${d.id}`, { displayName: d.displayName, depotId: d.depotId || null, maxShiftMinutes: d.maxShiftMinutes, active: !d.active });
      toast.success(t(d.active ? "fleet.nameDeactivated" : "fleet.nameActivated", { name: d.displayName }));
      await reload();
    } catch (e) {
      toast.error(t("fleet.notSaved"), { description: errorMessage(e) });
    }
  };
  const toggleVehicle = async (v: VehicleRow) => {
    try {
      await api("PATCH", `/v1/orgs/${org}/vehicles/${v.id}`, { label: v.label, licensePlate: v.licensePlate, depotId: v.depotId || null, capacityParcels: v.capacityParcels, active: !v.active });
      toast.success(t(v.active ? "fleet.nameDeactivated" : "fleet.nameActivated", { name: v.label }));
      await refreshAll();
    } catch (e) {
      toast.error(t("fleet.notSaved"), { description: errorMessage(e) });
    }
  };

  const th = "h-11 px-4 text-start font-bold g:h-9";
  // G: 36 px rows – compact cells, row hover, the row menu button does not add height.
  const tr = "border-b border-line last:border-0 g:hover:bg-[var(--hover)]";
  const rowMenu = "g:-my-1";
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5 g:gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink g:text-[20px] g:font-semibold g:tracking-[-0.015em]">{t("shell.title.fleet")}</h1>
            <p className="mt-1 text-sm text-ink-2 g:mt-0.5 g:text-[13px] g:text-muted">{session.companyWide ? session.organizationName : t("fleet.orgYourDepots", { org: session.organizationName })}</p>
          </div>
          <div className="flex gap-2">
            {tab === "drivers" && (
              <Button variant="primary" onClick={() => setDialog({ kind: "driver" })} disabled={!scoped.depots.length}>
                <Plus /> {t("fleet.addDriver")}
              </Button>
            )}
            {tab === "vehicles" && (
              <Button variant="primary" onClick={() => setDialog({ kind: "vehicle" })} disabled={!scoped.depots.length}>
                <Plus /> {t("fleet.addVehicle")}
              </Button>
            )}
            {tab === "depots" && canDepots && (
              <Button variant="primary" onClick={() => setDialog({ kind: "depot" })}>
                <Plus /> {t("fleet.addDepot")}
              </Button>
            )}
            {tab === "team" && isAdmin && (
              <Button variant="primary" onClick={() => setDialog({ kind: "invite" })}>
                <Mail /> {t("fleet.inviteMember")}
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line g:gap-0.5" role="tablist" aria-label={t("fleet.sections")}>
          {tabs
            .filter((x) => x.show)
            .map((x) => (
              <button
                key={x.key}
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => setTab(x.key)}
                className={cn(
                  "-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium [&_svg]:size-4 g:h-9 g:gap-1.5 g:px-2.5 g:text-[13px] g:[&_svg]:hidden",
                  tab === x.key ? "border-brand-600 text-ink g:border-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {x.icon}
                {x.label}
                {x.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-2xs tabular text-muted g:bg-transparent g:px-0 g:text-[12px]">{x.count}</span>}
              </button>
            ))}
        </div>

        <Card className="overflow-hidden">
          {tab === "drivers" &&
            (drivers.length === 0 ? (
              <EmptyState icon={<Users />} title={t("fleet.noDrivers")} description={t("fleet.noDriversHint")} />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                    <tr className="border-b border-line">
                      <th className={th}>{t("fleet.col.driver")}</th>
                      <th className={th}>{t("fleet.col.depot")}</th>
                      <th className={th}>{t("fleet.col.maxShift")}</th>
                      <th className={th}>{t("fleet.col.appLogin")}</th>
                      <th className={th}>{t("fleet.col.status")}</th>
                      <th className={cn(th, "w-12")}>
                        <span className="sr-only">{t("fleet.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id} className={tr}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5 font-medium text-ink g:gap-2">
                            <Avatar name={d.displayName} size="sm" className="g:size-5 g:text-[9px]" />
                            {d.displayName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{depotName(d.depotId)}</td>
                        <td className="px-4 py-3 tabular text-ink-2">{t("fleet.hoursValue", { n: fmt.number(d.maxShiftMinutes / 60, 1) })}</td>
                        <td className="px-4 py-3">{d.userId ? <Badge tone="success" className="g:text-[13px]"><span className="g:font-normal">{t("fleet.connected")}</span></Badge> : <Badge tone="outline" className="g:border-0 g:px-0 g:text-[13px]"><span className="g:font-normal">{t("fleet.noLogin")}</span></Badge>}</td>
                        <td className="px-4 py-3">{d.active ? <Badge tone="success" dot className="g:text-[13px]"><span className="g:font-normal">{t("fleet.active")}</span></Badge> : <Badge className="g:text-[13px]"><span className="g:font-normal">{t("fleet.inactive")}</span></Badge>}</td>
                        <td className="px-4 py-3 text-end">
                          <Menu>
                            <MenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className={rowMenu} aria-label={t("fleet.actionsFor", { name: d.displayName })}>
                                <Ellipsis />
                              </Button>
                            </MenuTrigger>
                            <MenuContent className="w-56">
                              <MenuItem onSelect={() => setDialog({ kind: "driver", item: d })}>{t("common.edit")}</MenuItem>
                              {!d.userId && <MenuItem onSelect={() => setDialog({ kind: "invite", item: d })}>{t("fleet.inviteToDriver")}</MenuItem>}
                              <MenuItem onSelect={() => void toggleDriver(d)}>{d.active ? t("fleet.deactivate") : t("fleet.activate")}</MenuItem>
                            </MenuContent>
                          </Menu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === "vehicles" &&
            (!vehicles ? (
              <p className="flex items-center gap-2 p-6 text-[13px] text-muted">
                <Loader2 className="size-4 animate-spin" /> {t("fleet.loadingVehicles")}
              </p>
            ) : vehicles.length === 0 ? (
              <EmptyState icon={<Truck />} title={t("fleet.noVehicles")} />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[600px] text-[13px]">
                  <thead className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">
                    <tr className="border-b border-line">
                      <th className={th}>{t("fleet.col.vehicle")}</th>
                      <th className={th}>{t("fleet.col.plate")}</th>
                      <th className={th}>{t("fleet.col.depot")}</th>
                      <th className={th}>{t("fleet.col.capacity")}</th>
                      <th className={th}>{t("fleet.col.status")}</th>
                      <th className={cn(th, "w-12")}>
                        <span className="sr-only">{t("fleet.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id} className={tr}>
                        <td className="px-4 py-3 font-medium text-ink">{v.label}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-2 g:text-[12.5px]">
                          <bdi>{v.licensePlate}</bdi>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{depotName(v.depotId)}</td>
                        <td className="px-4 py-3 tabular text-ink-2">{v.capacityParcels ?? "–"}</td>
                        <td className="px-4 py-3">{v.active ? <Badge tone="success" dot className="g:text-[13px]"><span className="g:font-normal">{t("fleet.active")}</span></Badge> : <Badge className="g:text-[13px]"><span className="g:font-normal">{t("fleet.inactive")}</span></Badge>}</td>
                        <td className="px-4 py-3 text-end">
                          <Menu>
                            <MenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className={rowMenu} aria-label={t("fleet.actionsFor", { name: v.label })}>
                                <Ellipsis />
                              </Button>
                            </MenuTrigger>
                            <MenuContent className="w-48">
                              <MenuItem onSelect={() => setDialog({ kind: "vehicle", item: v })}>{t("common.edit")}</MenuItem>
                              <MenuItem onSelect={() => void toggleVehicle(v)}>{v.active ? t("fleet.deactivate") : t("fleet.activate")}</MenuItem>
                            </MenuContent>
                          </Menu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === "depots" && (
            <ul className="divide-y divide-line">
              {scoped.depots.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 g:min-h-11 g:py-1.5 g:hover:bg-[var(--hover)]">
                  <span className="inline-flex size-9 items-center justify-center rounded-md bg-navy text-white g:hidden">
                    <Warehouse className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink">{d.name}</div>
                    <div className="text-xs text-muted g:text-[12px]">
                      {d.address.street} {d.address.houseNumber}, {d.address.postalCode} {d.address.city} · {d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}
                    </div>
                  </div>
                  {canDepots && (
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "depot", item: d })}>
                      {t("common.edit")}
                    </Button>
                  )}
                </li>
              ))}
              {!canDepots && <li className="px-4 py-3 text-xs text-muted g:py-2.5 g:text-[12px]">{t("fleet.depotsReadOnly")}</li>}
            </ul>
          )}

          {tab === "team" && isAdmin && (
            <div>
              {!team ? (
                <p className="flex items-center gap-2 p-6 text-[13px] text-muted">
                  <Loader2 className="size-4 animate-spin" /> {t("fleet.loadingTeam")}
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {team.members.map((m) => (
                      <li key={m.membershipId} className="flex items-center gap-3 px-4 py-3 g:min-h-11 g:py-1.5 g:hover:bg-[var(--hover)]">
                        <Avatar name={m.email} size="sm" className="g:size-5 g:text-[9px]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{m.email}</div>
                          <div className="text-xs text-muted g:text-[12px]">{memberScopeLabel(m, depotName, t)}</div>
                        </div>
                        <Badge tone={m.role === "owner" ? "brand" : "neutral"} className="g:text-[13px] g:font-normal g:text-ink-2"><span className="g:font-normal">{roleLabel(m.role, t)}</span></Badge>
                        {!m.active && <Badge className="g:text-[13px]"><span className="g:font-normal">{t("fleet.inactive")}</span></Badge>}
                      </li>
                    ))}
                  </ul>
                  {team.invitations.length > 0 && (
                    <div className="border-t border-line bg-surface-2/40 g:bg-transparent">
                      <h3 className="px-4 pt-3 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle g:border-b g:border-line g:pb-2 g:pt-2.5 g:text-[12px] g:font-medium g:text-ink-2">{t("fleet.pendingInvitations")}</h3>
                      <ul className="divide-y divide-line">
                        {team.invitations.map((i) => (
                          <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] g:min-h-9 g:py-1 g:hover:bg-[var(--hover)]">
                            <Mail className="size-4 text-subtle g:hidden" />
                            <span className="min-w-0 flex-1 truncate">{i.email}</span>
                            <Badge tone="outline" className="g:border-0 g:px-0 g:text-[13px] g:font-normal g:text-ink-2"><span className="g:font-normal">{roleLabel(i.role, t)}</span></Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                api("DELETE", `/v1/orgs/${org}/invitations/${i.id}`)
                                  .then(() => (toast.success(t("fleet.invitationRevoked")), loadTeam()))
                                  .catch((e) => toast.error(t("fleet.notRevoked"), { description: errorMessage(e) }))
                              }
                            >
                              {t("fleet.revoke")}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      <DriverDialog driver={dialog?.kind === "driver" ? ((dialog.item as DriverRow) ?? null) : null} open={dialog?.kind === "driver"} onOpenChange={(o) => !o && setDialog(null)} depots={scoped.depots} onSaved={refreshAll} />
      <VehicleDialog vehicle={dialog?.kind === "vehicle" ? ((dialog.item as VehicleRow) ?? null) : null} open={dialog?.kind === "vehicle"} onOpenChange={(o) => !o && setDialog(null)} depots={scoped.depots} onSaved={refreshAll} />
      <DepotDialog depot={dialog?.kind === "depot" ? ((dialog.item as Depot) ?? null) : null} open={dialog?.kind === "depot"} onOpenChange={(o) => !o && setDialog(null)} onSaved={refreshAll} />
      <InviteDialog driver={dialog?.kind === "invite" ? ((dialog.item as DriverRow) ?? null) : null} open={dialog?.kind === "invite"} onOpenChange={(o) => !o && setDialog(null)} depots={scoped.depots} onSaved={refreshAll} />
    </div>
  );
}

