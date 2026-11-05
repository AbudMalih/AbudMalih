"use client";

import { can, type Depot, type Driver, type Vehicle } from "@turvio/shared";
import { Avatar, Badge, Button, Card, Dialog, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, cn, toast } from "@turvio/web-ui/ds";
import { Ellipsis, Loader2, Mail, Plus, Truck, UserPlus, Users, Warehouse } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, errorMessage } from "../lib/api";
import { useDispatch } from "../lib/store";

type Tab = "drivers" | "vehicles" | "depots" | "team";
const inputCls = "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none";

function F({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-[13px] font-medium text-ink-2", className)}>
      {label}
      {children}
    </label>
  );
}

function FormDialog({ open, onOpenChange, title, submitLabel, onSubmit, valid = true, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; submitLabel: string; onSubmit: () => Promise<void>; valid?: boolean; children: ReactNode }) {
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
            variant="primary"
            disabled={busy || !valid}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit();
                onOpenChange(false);
              } catch (e) {
                toast.error("Not saved", { description: errorMessage(e) });
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </Dialog>
  );
}

type DriverRow = Driver & { userId?: string | null };
type VehicleRow = Vehicle & { active?: boolean };

function DriverDialog({ driver, open, onOpenChange, depots, onSaved }: { driver: DriverRow | null; open: boolean; onOpenChange: (o: boolean) => void; depots: Depot[]; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
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
      title={driver ? `Edit ${driver.displayName}` : "Add driver"}
      submitLabel={driver ? "Save" : "Add driver"}
      valid={!!name.trim() && hours >= 1 && hours <= 10}
      onSubmit={async () => {
        const body = { displayName: name.trim(), depotId: depot || null, maxShiftMinutes: Math.round(hours * 60), active: driver?.active ?? true };
        if (driver) await api("PATCH", `/v1/orgs/${session.organizationId}/drivers/${driver.id}`, body);
        else await api("POST", `/v1/orgs/${session.organizationId}/drivers`, body);
        toast.success(driver ? "Driver updated" : `${body.displayName} added`);
        await onSaved();
      }}
    >
      <F label="Name" className="sm:col-span-2">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </F>
      <F label="Depot">
        <select className={inputCls} value={depot} onChange={(e) => setDepot(e.target.value)}>
          {depots.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </F>
      <F label="Max. shift (hours)">
        <input className={inputCls} type="number" min={1} max={10} step={0.5} value={shift} onChange={(e) => setShift(e.target.value)} />
      </F>
    </FormDialog>
  );
}

function VehicleDialog({ vehicle, open, onOpenChange, depots, onSaved }: { vehicle: VehicleRow | null; open: boolean; onOpenChange: (o: boolean) => void; depots: Depot[]; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
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
      title={vehicle ? `Edit ${vehicle.label}` : "Add vehicle"}
      submitLabel={vehicle ? "Save" : "Add vehicle"}
      valid={!!label.trim() && !!plate.trim() && (!cap || Number(cap) > 0)}
      onSubmit={async () => {
        const body = { label: label.trim(), licensePlate: plate.trim(), depotId: depot || null, capacityParcels: cap ? Number(cap) : null, active: vehicle?.active ?? true };
        if (vehicle) await api("PATCH", `/v1/orgs/${session.organizationId}/vehicles/${vehicle.id}`, body);
        else await api("POST", `/v1/orgs/${session.organizationId}/vehicles`, body);
        toast.success(vehicle ? "Vehicle updated" : `${body.label} added`);
        await onSaved();
      }}
    >
      <F label="Name">
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sprinter 5" />
      </F>
      <F label="Licence plate">
        <input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="H-JL 105" />
      </F>
      <F label="Depot">
        <select className={inputCls} value={depot} onChange={(e) => setDepot(e.target.value)}>
          {depots.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </F>
      <F label="Capacity (parcels, optional)">
        <input className={inputCls} type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} />
      </F>
    </FormDialog>
  );
}

function DepotDialog({ depot, open, onOpenChange, onSaved }: { depot: Depot | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
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
      title={depot ? `Edit depot ${depot.name}` : "Add depot"}
      submitLabel={depot ? "Save" : "Add depot"}
      valid={valid}
      onSubmit={async () => {
        const body = { name: f.name, street: f.street, houseNumber: f.no || undefined, postalCode: f.postal, city: f.city, lat, lng };
        if (depot) await api("PATCH", `/v1/orgs/${session.organizationId}/depots/${depot.id}`, body);
        else await api("POST", `/v1/orgs/${session.organizationId}/depots`, body);
        toast.success(depot ? "Depot updated" : `Depot ${f.name} added`);
        await onSaved();
      }}
    >
      <F label="Name" className="sm:col-span-2">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </F>
      <F label="Street">
        <input className={inputCls} value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} />
      </F>
      <F label="No.">
        <input className={inputCls} value={f.no} onChange={(e) => setF({ ...f, no: e.target.value })} />
      </F>
      <F label="Postcode">
        <input className={inputCls} value={f.postal} onChange={(e) => setF({ ...f, postal: e.target.value })} />
      </F>
      <F label="City">
        <input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </F>
      <F label="Latitude">
        <input className={inputCls} value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} inputMode="decimal" />
      </F>
      <F label="Longitude">
        <input className={inputCls} value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} inputMode="decimal" />
      </F>
    </FormDialog>
  );
}

function InviteDialog({ open, onOpenChange, driver, depots, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; driver: DriverRow | null; depots: Depot[]; onSaved: () => Promise<void> }) {
  const { session } = useDispatch();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "dispatcher" | "owner">("dispatcher");
  const [scope, setScope] = useState<string[]>([]);
  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("dispatcher");
      setScope([]);
    }
  }, [open]);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={driver ? `Invite ${driver.displayName} to TURVIO Driver` : "Invite a team member"}
      submitLabel="Send invitation"
      valid={valid}
      onSubmit={async () => {
        await api("POST", `/v1/orgs/${session.organizationId}/invitations`, driver ? { email, role: "driver", driverId: driver.id } : { email, role, depotIds: role === "dispatcher" && scope.length ? scope : null });
        toast.success(`Invitation sent to ${email}`, { description: "The link is valid for 7 days." });
        await onSaved();
      }}
    >
      <F label="Email" className="sm:col-span-2">
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </F>
      {!driver && (
        <>
          <F label="Role">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="dispatcher">Dispatcher</option>
              <option value="admin">Admin</option>
              {session.role === "owner" && <option value="owner">Owner</option>}
            </select>
          </F>
          {role === "dispatcher" && (
            <fieldset className="flex flex-col gap-1 text-[13px] font-medium text-ink-2 sm:col-span-2">
              <legend className="mb-1">Depots (none = all depots)</legend>
              <div className="flex flex-wrap gap-2">
                {depots.map((d) => (
                  <label key={d.id} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-normal">
                    <input type="checkbox" className="accent-[#2563EB]" checked={scope.includes(d.id)} onChange={(e) => setScope(e.target.checked ? [...scope, d.id] : scope.filter((x) => x !== d.id))} />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
      {driver && <p className="text-xs text-muted sm:col-span-2">After accepting, the driver signs in to TURVIO Driver with this email and sees tours you publish to {driver.displayName}.</p>}
    </FormDialog>
  );
}

interface TeamData {
  members: { membershipId: string; email: string; role: string; active: boolean; depotIds: string[] | null; driverId: string | null }[];
  invitations: { id: string; email: string; role: string; expiresAt: string }[];
}

export function FleetView() {
  const { scoped, session, reload } = useDispatch();
  const [tab, setTab] = useState<Tab>("drivers");
  const [vehicles, setVehicles] = useState<VehicleRow[] | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [dialog, setDialog] = useState<null | { kind: "driver" | "vehicle" | "depot" | "invite"; item?: unknown }>(null);
  const org = session.organizationId;
  const isAdmin = can(session.role, "org.members.manage");
  const canDepots = can(session.role, "depots.manage");

  const loadVehicles = useCallback(() => api<VehicleRow[]>("GET", `/v1/orgs/${org}/vehicles`).then(setVehicles), [org]);
  const loadTeam = useCallback(() => (isAdmin ? api<TeamData>("GET", `/v1/orgs/${org}/members`).then(setTeam) : Promise.resolve()), [org, isAdmin]);
  useEffect(() => {
    loadVehicles().catch((e) => toast.error("Vehicles not loaded", { description: errorMessage(e) }));
    loadTeam().catch((e) => toast.error("Team not loaded", { description: errorMessage(e) }));
  }, [loadVehicles, loadTeam]);
  const refreshAll = async () => {
    await Promise.all([reload(), loadVehicles(), loadTeam()]);
  };
  const depotName = (id: string | null | undefined) => scoped.depots.find((d) => d.id === id)?.name ?? "–";
  const drivers = scoped.drivers as DriverRow[];

  const tabs: { key: Tab; label: string; icon: ReactNode; count?: number; show: boolean }[] = [
    { key: "drivers", label: "Drivers", icon: <Users />, count: drivers.length, show: true },
    { key: "vehicles", label: "Vehicles", icon: <Truck />, count: vehicles?.length, show: true },
    { key: "depots", label: "Depots", icon: <Warehouse />, count: scoped.depots.length, show: true },
    { key: "team", label: "Team", icon: <UserPlus />, count: team?.members.length, show: isAdmin },
  ];

  const toggleDriver = async (d: DriverRow) => {
    try {
      await api("PATCH", `/v1/orgs/${org}/drivers/${d.id}`, { displayName: d.displayName, depotId: d.depotId || null, maxShiftMinutes: d.maxShiftMinutes, active: !d.active });
      toast.success(`${d.displayName} ${d.active ? "deactivated" : "activated"}`);
      await reload();
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
    }
  };
  const toggleVehicle = async (v: VehicleRow) => {
    try {
      await api("PATCH", `/v1/orgs/${org}/vehicles/${v.id}`, { label: v.label, licensePlate: v.licensePlate, depotId: v.depotId || null, capacityParcels: v.capacityParcels, active: !v.active });
      toast.success(`${v.label} ${v.active ? "deactivated" : "activated"}`);
      await refreshAll();
    } catch (e) {
      toast.error("Not saved", { description: errorMessage(e) });
    }
  };

  const th = "h-10 px-4 text-start font-medium";
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Fleet & team</h1>
            <p className="text-sm text-muted">{session.organizationName}{session.companyWide ? "" : " · your depots"}</p>
          </div>
          <div className="flex gap-2">
            {tab === "drivers" && (
              <Button variant="primary" onClick={() => setDialog({ kind: "driver" })} disabled={!scoped.depots.length}>
                <Plus /> Add driver
              </Button>
            )}
            {tab === "vehicles" && (
              <Button variant="primary" onClick={() => setDialog({ kind: "vehicle" })} disabled={!scoped.depots.length}>
                <Plus /> Add vehicle
              </Button>
            )}
            {tab === "depots" && canDepots && (
              <Button variant="primary" onClick={() => setDialog({ kind: "depot" })}>
                <Plus /> Add depot
              </Button>
            )}
            {tab === "team" && isAdmin && (
              <Button variant="primary" onClick={() => setDialog({ kind: "invite" })}>
                <Mail /> Invite member
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Fleet sections">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium [&_svg]:size-4",
                  tab === t.key ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.icon}
                {t.label}
                {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-2xs tabular text-muted">{t.count}</span>}
              </button>
            ))}
        </div>

        <Card className="overflow-hidden">
          {tab === "drivers" &&
            (drivers.length === 0 ? (
              <EmptyState icon={<Users />} title="No drivers yet" description="Add drivers, then invite them to the TURVIO Driver app." />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead className="bg-surface-2/60 text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className={th}>Driver</th>
                      <th className={th}>Depot</th>
                      <th className={th}>Max. shift</th>
                      <th className={th}>App login</th>
                      <th className={th}>Status</th>
                      <th className={cn(th, "w-12")}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5 font-medium text-ink">
                            <Avatar name={d.displayName} size="sm" />
                            {d.displayName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{depotName(d.depotId)}</td>
                        <td className="px-4 py-3 tabular text-ink-2">{(d.maxShiftMinutes / 60).toFixed(1)} h</td>
                        <td className="px-4 py-3">{d.userId ? <Badge tone="success">Connected</Badge> : <Badge tone="outline">No login</Badge>}</td>
                        <td className="px-4 py-3">{d.active ? <Badge tone="success" dot>Active</Badge> : <Badge>Inactive</Badge>}</td>
                        <td className="px-4 py-3 text-end">
                          <Menu>
                            <MenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.displayName}`}>
                                <Ellipsis />
                              </Button>
                            </MenuTrigger>
                            <MenuContent className="w-56">
                              <MenuItem onSelect={() => setDialog({ kind: "driver", item: d })}>Edit</MenuItem>
                              {!d.userId && <MenuItem onSelect={() => setDialog({ kind: "invite", item: d })}>Invite to TURVIO Driver</MenuItem>}
                              <MenuItem onSelect={() => void toggleDriver(d)}>{d.active ? "Deactivate" : "Activate"}</MenuItem>
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
                <Loader2 className="size-4 animate-spin" /> Loading vehicles…
              </p>
            ) : vehicles.length === 0 ? (
              <EmptyState icon={<Truck />} title="No vehicles yet" />
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[600px] text-[13px]">
                  <thead className="bg-surface-2/60 text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className={th}>Vehicle</th>
                      <th className={th}>Plate</th>
                      <th className={th}>Depot</th>
                      <th className={th}>Capacity</th>
                      <th className={th}>Status</th>
                      <th className={cn(th, "w-12")}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-medium text-ink">{v.label}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-2">{v.licensePlate}</td>
                        <td className="px-4 py-3 text-ink-2">{depotName(v.depotId)}</td>
                        <td className="px-4 py-3 tabular text-ink-2">{v.capacityParcels ?? "–"}</td>
                        <td className="px-4 py-3">{v.active ? <Badge tone="success" dot>Active</Badge> : <Badge>Inactive</Badge>}</td>
                        <td className="px-4 py-3 text-end">
                          <Menu>
                            <MenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${v.label}`}>
                                <Ellipsis />
                              </Button>
                            </MenuTrigger>
                            <MenuContent className="w-48">
                              <MenuItem onSelect={() => setDialog({ kind: "vehicle", item: v })}>Edit</MenuItem>
                              <MenuItem onSelect={() => void toggleVehicle(v)}>{v.active ? "Deactivate" : "Activate"}</MenuItem>
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
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-md bg-navy text-white">
                    <Warehouse className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink">{d.name}</div>
                    <div className="text-xs text-muted">
                      {d.address.street} {d.address.houseNumber}, {d.address.postalCode} {d.address.city} · {d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}
                    </div>
                  </div>
                  {canDepots && (
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "depot", item: d })}>
                      Edit
                    </Button>
                  )}
                </li>
              ))}
              {!canDepots && <li className="px-4 py-3 text-xs text-muted">Only owners and admins can add or edit depots.</li>}
            </ul>
          )}

          {tab === "team" && isAdmin && (
            <div>
              {!team ? (
                <p className="flex items-center gap-2 p-6 text-[13px] text-muted">
                  <Loader2 className="size-4 animate-spin" /> Loading team…
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {team.members.map((m) => (
                      <li key={m.membershipId} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={m.email} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{m.email}</div>
                          <div className="text-xs text-muted">{m.role === "dispatcher" && m.depotIds?.length ? m.depotIds.map(depotName).join(", ") : m.role === "driver" ? "TURVIO Driver" : "All depots"}</div>
                        </div>
                        <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role}</Badge>
                        {!m.active && <Badge>Inactive</Badge>}
                      </li>
                    ))}
                  </ul>
                  {team.invitations.length > 0 && (
                    <div className="border-t border-line bg-surface-2/40">
                      <h3 className="px-4 pt-3 text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">Pending invitations</h3>
                      <ul className="divide-y divide-line">
                        {team.invitations.map((i) => (
                          <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                            <Mail className="size-4 text-subtle" />
                            <span className="min-w-0 flex-1 truncate">{i.email}</span>
                            <Badge tone="outline">{i.role}</Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                api("DELETE", `/v1/orgs/${org}/invitations/${i.id}`)
                                  .then(() => (toast.success("Invitation revoked"), loadTeam()))
                                  .catch((e) => toast.error("Not revoked", { description: errorMessage(e) }))
                              }
                            >
                              Revoke
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
