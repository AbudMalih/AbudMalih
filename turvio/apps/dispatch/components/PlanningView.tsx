"use client";

import { formatClock, parseMinuteOfDay, type Driver, type TourSummary, type Vehicle } from "@turvio/shared";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  EmptyState,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
  cn,
  toast,
} from "@turvio/web-ui/ds";
import { ArrowUpFromLine, CalendarX2, ChevronDown, Info, PackagePlus, Plus, RotateCcw, Sparkles, Star, Truck, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { driverBusy, tourColor, vehicleBusy } from "../lib/draft";
import { optimizeTour } from "../lib/optimize";
import { useDispatch } from "../lib/store";
import { TourStatusBadge } from "./StatusBadge";
import { TourDetailSheet } from "./TourDetail";

const selectCls =
  "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none";

function AssignMenu<T extends { id: string }>({
  label,
  icon,
  current,
  options,
  busyOf,
  render,
  onPick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  current: T | undefined;
  options: T[];
  busyOf: (o: T) => string | null;
  render: (o: T) => string;
  onPick: (o: T | null) => void;
  disabled?: boolean;
}) {
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <Button variant="secondary" size="sm" className={cn("w-full justify-start", !current && "border-amber-200 bg-warning-soft/50 text-warning-ink")} aria-label={`${label}: ${current ? render(current) : "not assigned"}`}>
          {icon}
          <span className="truncate">{current ? render(current) : `Assign ${label.toLowerCase()}`}</span>
          <ChevronDown className="ms-auto text-subtle" />
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{label}</MenuLabel>
        {options.map((o) => {
          const busy = busyOf(o);
          return (
            <MenuItem key={o.id} disabled={!!busy} hint={busy ?? undefined} onSelect={() => onPick(o)}>
              {render(o)}
            </MenuItem>
          );
        })}
        {current && <MenuItem onSelect={() => onPick(null)}>Remove assignment</MenuItem>}
      </MenuContent>
    </Menu>
  );
}

function TourCard({ s }: { s: TourSummary }) {
  const { scoped, assign, selectTour, setOrder } = useDispatch();
  const [busy, setBusy] = useState(false);
  const drivers = scoped.drivers.filter((d) => d.depotId === s.depot.id);
  const vehicles = scoped.vehicles.filter((v) => v.depotId === s.depot.id);
  const locked = s.tour.status === "completed";
  const driverBusyLabel = (d: Driver) => (!d.active ? "inactive" : (() => {
    const t = driverBusy(scoped, d.id, s.tour.id);
    return t ? `on ${t.name}` : null;
  })());
  const vehicleBusyLabel = (v: Vehicle) => {
    const t = vehicleBusy(scoped, v.id, s.tour.id);
    return t ? `on ${t.name}` : null;
  };
  const optimize = async () => {
    setBusy(true);
    try {
      const r = await optimizeTour(s);
      setOrder(s.tour.id, r.stopIds);
      toast.success(`${s.tour.name}: stops re-ordered (draft)`, { description: r.note });
    } catch (e) {
      toast.error("Optimization failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card interactive className="relative flex flex-col gap-3 overflow-hidden p-4" role="group" aria-label={`Tour ${s.tour.name}`}>
      <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: tourColor(scoped, s.tour.id) }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button onClick={() => selectTour(s.tour.id)} className="text-[15px] font-semibold text-ink hover:text-brand-700">
            {s.tour.name}
          </button>
          <div className="text-xs text-muted">
            {s.depot.name} · start {formatClock(s.tour.plannedStartMinute)}
            {s.tour.id.startsWith("draft_") && <Badge tone="brand" className="ms-1.5">New · draft</Badge>}
          </div>
        </div>
        <TourStatusBadge status={s.status} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <AssignMenu
          label="Driver"
          icon={<UserRound />}
          current={drivers.find((d) => d.id === s.tour.driverId)}
          options={drivers}
          busyOf={driverBusyLabel}
          render={(d) => d.displayName}
          disabled={locked}
          onPick={(d) => {
            assign(s.tour.id, { driverId: d?.id ?? null });
            toast(d ? `${d.displayName} assigned to ${s.tour.name}` : `Driver removed from ${s.tour.name}`, { description: "Draft – not saved yet" });
          }}
        />
        <AssignMenu
          label="Vehicle"
          icon={<Truck />}
          current={vehicles.find((v) => v.id === s.tour.vehicleId)}
          options={vehicles}
          busyOf={vehicleBusyLabel}
          render={(v) => `${v.label} · ${v.licensePlate}`}
          disabled={locked}
          onPick={(v) => {
            assign(s.tour.id, { vehicleId: v?.id ?? null });
            toast(v ? `${v.label} assigned to ${s.tour.name}` : `Vehicle removed from ${s.tour.name}`, { description: "Draft – not saved yet" });
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular">
          {s.total} stops · {s.remaining} open · {s.pickups} pickups
        </span>
        <Button size="sm" variant="ghost" onClick={optimize} disabled={busy || locked || s.remaining < 2}>
          <Sparkles /> {busy ? "Optimizing…" : "Optimize"}
        </Button>
      </div>
    </Card>
  );
}

function NewTourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { scoped, depotId, createTour } = useDispatch();
  const [depot, setDepot] = useState(depotId ?? scoped.depots[0]?.id ?? "");
  const [start, setStart] = useState("13:00");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const startMinute = parseMinuteOfDay(start);
  const freeDrivers = scoped.drivers.filter((d) => d.depotId === depot && d.active && !driverBusy(scoped, d.id));
  const freeVehicles = scoped.vehicles.filter((v) => v.depotId === depot && !vehicleBusy(scoped, v.id));
  const submit = () => {
    if (startMinute === null || !depot) return;
    const t = createTour({ depotId: depot, startMinute, driverId: driver || null, vehicleId: vehicle || null });
    toast.success(`Tour ${t.name} created`, { description: "Draft – not saved yet. Assign stops from the unassigned list." });
    onOpenChange(false);
    setDriver("");
    setVehicle("");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New tour"
      description="Creates a planned tour in your local planning draft."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={startMinute === null || !depot}>
            Create tour
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Depot
          <select className={selectCls} value={depot} onChange={(e) => (setDepot(e.target.value), setDriver(""), setVehicle(""))}>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Start time
          <input type="time" className={cn(selectCls, startMinute === null && "border-danger")} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={startMinute === null} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Driver
          <select className={selectCls} value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Assign later</option>
            {freeDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted">{freeDrivers.length} available</span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Vehicle
          <select className={selectCls} value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="">Assign later</option>
            {freeVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.licensePlate}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted">{freeVehicles.length} available</span>
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

export function PlanningView() {
  const d = useDispatch();
  const { data, summaries, draftChanges, resetDraft, moveStops, setPriority, hasDataForDate, date, scoped } = d;
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const openTours = summaries.filter((s) => s.tour.status !== "completed");
  const doneTours = summaries.filter((s) => s.tour.status === "completed");
  const selectedStops = data.unassigned.filter((u) => selected.has(u.id));
  const selectedDepots = new Set(selectedStops.map((u) => u.depotId));
  const targetTours = selectedDepots.size === 1 ? openTours.filter((s) => selectedDepots.has(s.depot.id)) : [];
  const driverRows = useMemo(
    () =>
      data.drivers.map((dr) => {
        const t = driverBusy(data, dr.id);
        return { dr, t };
      }),
    [data],
  );
  const freeVehicles = data.vehicles.filter((v) => !vehicleBusy(data, v.id));

  if (!hasDataForDate) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<CalendarX2 />}
          title={`No plan for ${date}`}
          description={`Synthetic development data exists for ${scoped.date} only. With the database connected, this view will load the plan for any date.`}
          action={
            <Button variant="secondary" onClick={() => d.setDate(scoped.date)}>
              Go to {scoped.date}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Planning</h1>
            <p className="text-sm text-muted">
              {data.date} · {data.depots.length === 1 ? data.depots[0]!.name : `${data.depots.length} depots`} · {openTours.length} open tours
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draftChanges > 0 && (
              <Button variant="ghost" onClick={() => (resetDraft(), toast("Draft discarded"))}>
                <RotateCcw /> Discard draft
              </Button>
            )}
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus /> New tour
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-[13px] text-brand-700" role="note">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Local planning draft{draftChanges ? ` · ${draftChanges} change${draftChanges > 1 ? "s" : ""}` : ""}.</strong> Edits update all views in this browser session but are not saved to the server yet – the write API for tours is the next backend milestone.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Tours" className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {openTours.map((s) => (
                <TourCard key={s.tour.id} s={s} />
              ))}
            </div>
            {doneTours.length > 0 && <p className="text-xs text-muted">{doneTours.length} completed tour{doneTours.length > 1 ? "s" : ""} hidden ({doneTours.map((s) => s.tour.name).join(", ")}).</p>}
          </section>

          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden">
              <CardHeader
                title={`Unassigned stops · ${data.unassigned.length}`}
                description="Select stops of one depot, then assign them to a tour."
                actions={
                  <Menu>
                    <MenuTrigger asChild disabled={selected.size === 0 || targetTours.length === 0}>
                      <Button size="sm" variant="primary">
                        <PackagePlus /> Assign
                      </Button>
                    </MenuTrigger>
                    <MenuContent className="w-56">
                      <MenuLabel>Assign {selected.size} to tour</MenuLabel>
                      {targetTours.map((s) => (
                        <MenuItem
                          key={s.tour.id}
                          hint={`${s.remaining} open`}
                          onSelect={() => {
                            moveStops([...selected], s.tour.id);
                            toast.success(`${selected.size} stop${selected.size > 1 ? "s" : ""} assigned to ${s.tour.name}`, { description: "Draft – run Optimize to re-order the tour." });
                            setSelected(new Set());
                          }}
                        >
                          {s.tour.name}
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </Menu>
                }
              />
              {selected.size > 0 && selectedDepots.size > 1 && <p className="border-b border-line bg-warning-soft px-4 py-2 text-xs text-warning-ink">Selected stops belong to different depots – assign them separately.</p>}
              {data.unassigned.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-muted">All stops are planned.</p>
              ) : (
                <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
                  {data.unassigned.map((u) => (
                    <li key={u.id} className={cn("flex items-center gap-3 px-4 py-2.5", selected.has(u.id) && "bg-brand-50/50")}>
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={(v) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (v) n.add(u.id);
                            else n.delete(u.id);
                            return n;
                          })
                        }
                        label={`Select ${u.recipientName}, ${u.address.street} ${u.address.houseNumber ?? ""}`.trim()}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-ink">{u.recipientName}</span>
                          {u.type === "pickup" && <ArrowUpFromLine className="size-3.5 shrink-0 text-violet-600" aria-label="Pickup" />}
                        </div>
                        <div className="truncate text-2xs text-muted">
                          {scoped.depots.find((x) => x.id === u.depotId)?.name} · {u.address.street} {u.address.houseNumber}
                          {u.timeWindow && ` · ${formatClock(u.timeWindow.start)}–${formatClock(u.timeWindow.end)}`}
                        </div>
                      </div>
                      <button
                        onClick={() => setPriority(u.id, !u.priority)}
                        aria-pressed={u.priority}
                        aria-label={u.priority ? `Remove priority from ${u.recipientName}` : `Mark ${u.recipientName} as priority`}
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-2"
                      >
                        <Star className={cn("size-4", u.priority ? "fill-amber-400 text-amber-500" : "text-subtle")} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Drivers" description={`${driverRows.filter((r) => !r.t && r.dr.active).length} available`} />
              <ul className="divide-y divide-line">
                {driverRows.map(({ dr, t }) => (
                  <li key={dr.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={dr.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{dr.displayName}</div>
                      <div className="text-2xs text-muted">
                        {scoped.depots.find((x) => x.id === dr.depotId)?.name} · max {Math.round(dr.maxShiftMinutes / 60)} h
                      </div>
                    </div>
                    {!dr.active ? <Badge>Inactive</Badge> : t ? <Badge tone="brand">{t.name}</Badge> : <Badge tone="success" dot>Available</Badge>}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Vehicles" description={`${freeVehicles.length} of ${data.vehicles.length} available`} />
              <ul className="divide-y divide-line">
                {data.vehicles.map((v) => {
                  const t = vehicleBusy(data, v.id);
                  return (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex size-7 items-center justify-center rounded-md bg-surface-2 text-ink-2">
                        <Truck className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink">{v.label}</div>
                        <div className="text-2xs text-muted">
                          {v.licensePlate} · {v.capacityParcels ?? "–"} parcels
                        </div>
                      </div>
                      {t ? <Badge tone="brand">{t.name}</Badge> : <Badge tone="success" dot>Available</Badge>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </div>
      <NewTourDialog open={newOpen} onOpenChange={setNewOpen} />
      <TourDetailSheet />
    </div>
  );
}
