"use client";

import { formatClock, parseMinuteOfDay, type Driver, type TourSummary, type Vehicle } from "@turvio/shared";
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, Dialog, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Tooltip, cn, toast } from "@turvio/web-ui/ds";
import { ArrowUpFromLine, CalendarX2, ChevronDown, Loader2, PackagePlus, Plus, Send, Sparkles, Star, Truck, UserRound, Wand2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { driverBusy, tourColor, vehicleBusy } from "../lib/helpers";
import { optimizeNotes, optimizeProblems } from "../lib/optimize";
import { useDispatch } from "../lib/store";
import { AddStopsDialog } from "./AddStopsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TourStatusBadge } from "./StatusBadge";
import { TourDetailSheet } from "./TourDetail";

const selectCls = "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none";

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
  icon: ReactNode;
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
        {options.length === 0 && <MenuItem disabled>No {label.toLowerCase()}s in this depot</MenuItem>}
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
  const { scoped, updateTour, selectTour, optimizeTour, publishTour } = useDispatch();
  const [busy, setBusy] = useState<null | "optimize" | "assign">(null);
  const [publishing, setPublishing] = useState(false);
  const drivers = scoped.drivers.filter((d) => d.depotId === s.depot.id && d.active);
  const vehicles = scoped.vehicles.filter((v) => v.depotId === s.depot.id);
  const locked = s.tour.status === "completed";
  const driverBusyLabel = (d: Driver) => {
    const t = driverBusy(scoped, d.id, s.tour.id);
    return t ? `on ${t.name}` : null;
  };
  const vehicleBusyLabel = (v: Vehicle) => {
    const t = vehicleBusy(scoped, v.id, s.tour.id);
    return t ? `on ${t.name}` : null;
  };
  const assign = async (patch: { driverId?: string | null; vehicleId?: string | null }, msg: string) => {
    setBusy("assign");
    try {
      await updateTour(s.tour, patch);
      toast.success(msg);
    } catch (e) {
      toast.error("Assignment not saved", { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  const optimize = async () => {
    setBusy("optimize");
    try {
      // Tours on the road answer 409 here: they are re-sequenced from the tour detail with a preview.
      const r = (await optimizeTour(s.tour)).result;
      const problems = optimizeProblems(r);
      (problems.length ? toast.warning : toast.success)(`${s.tour.name} optimized and saved`, { description: [...problems, ...optimizeNotes(r)].join(" · ") });
    } catch (e) {
      toast.error("Optimization failed", { description: errorMessage(e) });
    } finally {
      setBusy(null);
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
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <TourStatusBadge status={s.status} />
          {s.tour.publishedAt ? <Badge tone="success">Published</Badge> : <Badge tone="outline">Not published</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <AssignMenu
          label="Driver"
          icon={busy === "assign" ? <Loader2 className="animate-spin" /> : <UserRound />}
          current={scoped.drivers.find((d) => d.id === s.tour.driverId)}
          options={drivers}
          busyOf={driverBusyLabel}
          render={(d) => d.displayName}
          disabled={locked || busy !== null}
          onPick={(d) => void assign({ driverId: d?.id ?? null }, d ? `${d.displayName} assigned to ${s.tour.name}` : `Driver removed from ${s.tour.name}`)}
        />
        <AssignMenu
          label="Vehicle"
          icon={<Truck />}
          current={scoped.vehicles.find((v) => v.id === s.tour.vehicleId)}
          options={vehicles}
          busyOf={vehicleBusyLabel}
          render={(v) => `${v.label} · ${v.licensePlate}`}
          disabled={locked || busy !== null}
          onPick={(v) => void assign({ vehicleId: v?.id ?? null }, v ? `${v.label} assigned to ${s.tour.name}` : `Vehicle removed from ${s.tour.name}`)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular">
          {s.total} stops · {s.remaining} open · {s.pickups} pickups
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={optimize} disabled={busy !== null || locked || s.remaining < 2}>
            {busy === "optimize" ? <Loader2 className="animate-spin" /> : <Sparkles />} Optimize
          </Button>
          {!s.tour.publishedAt && !locked && (
            <Tooltip content={!s.tour.driverId ? "Assign a driver first" : s.total === 0 ? "Add stops first" : "Make the tour visible in TURVIO Driver"}>
              <span>
                <Button size="sm" variant="ghost" onClick={() => setPublishing(true)} disabled={!s.tour.driverId || s.total === 0}>
                  <Send /> Publish
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={publishing}
        onOpenChange={setPublishing}
        title={`Publish ${s.tour.name}?`}
        description={`${s.driver?.displayName ?? "The driver"} will see ${s.total} stops in TURVIO Driver.`}
        confirmLabel="Publish"
        onConfirm={() =>
          publishTour(s.tour).then(
            () => toast.success(`${s.tour.name} published`),
            (e) => {
              toast.error("Could not publish", { description: errorMessage(e) });
              throw e;
            },
          )
        }
      />
    </Card>
  );
}

function NewTourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { scoped, depotId, createTour, selectTour, date } = useDispatch();
  const [depot, setDepot] = useState(depotId ?? scoped.depots[0]?.id ?? "");
  const [start, setStart] = useState("07:30");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [busy, setBusy] = useState(false);
  const startMinute = parseMinuteOfDay(start);
  const freeDrivers = scoped.drivers.filter((d) => d.depotId === depot && d.active && !driverBusy(scoped, d.id));
  const freeVehicles = scoped.vehicles.filter((v) => v.depotId === depot && !vehicleBusy(scoped, v.id));
  const submit = async () => {
    if (startMinute === null || !depot) return;
    setBusy(true);
    try {
      const t = await createTour({ depotId: depot, plannedStartMinute: startMinute, driverId: driver || null, vehicleId: vehicle || null });
      toast.success(`Tour ${t.name} created`, { description: "Add stops, optimize and publish it to the driver." });
      onOpenChange(false);
      setDriver("");
      setVehicle("");
      selectTour(t.id);
    } catch (e) {
      toast.error("Tour not created", { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="New tour"
      description={`Planned for ${date}.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || startMinute === null || !depot}>
            {busy && <Loader2 className="animate-spin" />}
            Create tour
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
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
  const { data, summaries, assignStops, setPriority, date, depotId, scoped, optimizePlan, session } = useDispatch();
  const [newOpen, setNewOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const openTours = summaries.filter((s) => s.tour.status !== "completed");
  const doneTours = summaries.filter((s) => s.tour.status === "completed");
  const selectedStops = data.unassigned.filter((u) => selected.has(u.id));
  const selectedDepots = new Set(selectedStops.map((u) => u.depotId));
  const targetTours = selectedDepots.size === 1 ? openTours.filter((s) => selectedDepots.has(s.depot.id)) : [];
  const depot = scoped.depots.find((d) => d.id === depotId) ?? (scoped.depots.length === 1 ? scoped.depots[0] : undefined);
  const plannedHere = openTours.filter((s) => s.tour.status === "planned" && (!depot || s.depot.id === depot.id));
  const driverRows = useMemo(() => data.drivers.map((dr) => ({ dr, t: driverBusy(data, dr.id) })), [data]);
  const freeVehicles = data.vehicles.filter((v) => !vehicleBusy(data, v.id));
  const canManage = session.role !== "driver";

  const runPlan = async () => {
    if (!depot) return;
    setPlanBusy(true);
    try {
      const r = await optimizePlan(
        plannedHere.map((s) => s.tour.id),
        true,
      );
      toast.success(`${plannedHere.length} tours of ${depot.name} re-planned and saved`, {
        description: `${r.matrixSource === "osrm" ? "Road-network times" : "Straight-line time estimates"}${r.unassignedStopIds.length ? ` · ${r.unassignedStopIds.length} stop(s) left unassigned` : ""}`,
      });
    } catch (e) {
      toast.error("Plan optimization failed", { description: errorMessage(e) });
    } finally {
      setPlanBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Planning</h1>
            <p className="text-sm text-muted">
              {date} · {depot ? depot.name : `${data.depots.length} depots`} · {openTours.length} open tour{openTours.length === 1 ? "" : "s"}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip content={!depot ? "Select a depot first" : plannedHere.length === 0 ? "No planned tours in this depot" : "Distribute open and unassigned stops across the planned tours"}>
                <span>
                  <Button variant="secondary" onClick={runPlan} disabled={!depot || plannedHere.length === 0 || planBusy}>
                    {planBusy ? <Loader2 className="animate-spin" /> : <Wand2 />} Optimize depot plan
                  </Button>
                </span>
              </Tooltip>
              <Tooltip content={depot ? `Add stops to the unassigned list of ${depot.name}` : "Select a depot first"}>
                <span>
                  <Button variant="secondary" onClick={() => setAddOpen(true)} disabled={!depot}>
                    <PackagePlus /> Add stops
                  </Button>
                </span>
              </Tooltip>
              <Button variant="primary" onClick={() => setNewOpen(true)} disabled={scoped.depots.length === 0}>
                <Plus /> New tour
              </Button>
            </div>
          )}
        </div>

        {summaries.length === 0 && data.unassigned.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarX2 />}
              title={`No tours planned for ${date}`}
              description="Create a tour, add its stops, assign a driver and vehicle, optimize and publish it."
              action={
                canManage && (
                  <Button variant="primary" onClick={() => setNewOpen(true)}>
                    <Plus /> New tour
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section aria-label="Tours" className="flex flex-col gap-3">
              {openTours.length === 0 ? (
                <Card className="p-6 text-center text-[13px] text-muted">No open tours. Create one to plan the unassigned stops.</Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {openTours.map((s) => (
                    <TourCard key={s.tour.id} s={s} />
                  ))}
                </div>
              )}
              {doneTours.length > 0 && (
                <p className="text-xs text-muted">
                  {doneTours.length} completed tour{doneTours.length > 1 ? "s" : ""} hidden ({doneTours.map((s) => s.tour.name).join(", ")}).
                </p>
              )}
            </section>

            <div className="flex flex-col gap-4">
              <Card className="overflow-hidden">
                <CardHeader
                  title={`Unassigned stops · ${data.unassigned.length}`}
                  description="Select stops of one depot, then assign them to a tour."
                  actions={
                    <Menu>
                      <MenuTrigger asChild disabled={selected.size === 0 || targetTours.length === 0 || assignBusy}>
                        <Button size="sm" variant="primary">
                          {assignBusy ? <Loader2 className="animate-spin" /> : <PackagePlus />} Assign
                        </Button>
                      </MenuTrigger>
                      <MenuContent className="w-56">
                        <MenuLabel>Assign {selected.size} to tour</MenuLabel>
                        {targetTours.map((s) => (
                          <MenuItem
                            key={s.tour.id}
                            hint={`${s.remaining} open`}
                            onSelect={async () => {
                              setAssignBusy(true);
                              try {
                                await assignStops([...selected], s.tour.id);
                                toast.success(`${selected.size} stop${selected.size > 1 ? "s" : ""} assigned to ${s.tour.name}`, { description: "Saved. Optimize the tour to place them in the route." });
                                setSelected(new Set());
                              } catch (e) {
                                toast.error("Stops not assigned", { description: errorMessage(e) });
                              } finally {
                                setAssignBusy(false);
                              }
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
                {selected.size > 0 && selectedDepots.size === 1 && targetTours.length === 0 && <p className="border-b border-line bg-warning-soft px-4 py-2 text-xs text-warning-ink">No open tour in this depot – create one first.</p>}
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
                          label={`Select ${u.recipientName ?? u.address.street}, ${u.address.street} ${u.address.houseNumber ?? ""}`.trim()}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-ink">{u.recipientName ?? u.address.street}</span>
                            {u.type === "pickup" && <ArrowUpFromLine className="size-3.5 shrink-0 text-violet-600" aria-label="Pickup" />}
                          </div>
                          <div className="truncate text-2xs text-muted">
                            {scoped.depots.find((x) => x.id === u.depotId)?.name} · {u.address.street} {u.address.houseNumber}
                            {u.timeWindow && ` · ${formatClock(u.timeWindow.start)}–${formatClock(u.timeWindow.end)}`}
                          </div>
                        </div>
                        <button
                          onClick={() => setPriority(u.id, !u.priority).catch((e) => toast.error("Priority not saved", { description: errorMessage(e) }))}
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
                          {scoped.depots.find((x) => x.id === dr.depotId)?.name ?? "No depot"} · max {Math.round(dr.maxShiftMinutes / 60)} h
                        </div>
                      </div>
                      {!dr.active ? (
                        <Badge>Inactive</Badge>
                      ) : t ? (
                        <Badge tone="brand">{t.name}</Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Available
                        </Badge>
                      )}
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
                        {t ? (
                          <Badge tone="brand">{t.name}</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Available
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          </div>
        )}
      </div>
      <NewTourDialog open={newOpen} onOpenChange={setNewOpen} />
      {depot && <AddStopsDialog open={addOpen} onOpenChange={setAddOpen} target={{ depotId: depot.id }} targetLabel={`${depot.name} (unassigned)`} defaultCity={depot.address.city} />}
      <TourDetailSheet />
    </div>
  );
}
