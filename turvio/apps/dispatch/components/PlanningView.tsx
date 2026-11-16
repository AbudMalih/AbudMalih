"use client";

import Link from "next/link";
import { can, formatClock, parseMinuteOfDay, type Driver, type TourSummary, type Vehicle } from "@turvio/shared";
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, Dialog, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger, Tooltip, cn, toast } from "@turvio/web-ui/ds";
import { ArrowUpFromLine, CalendarX2, ChevronDown, Loader2, MapPinned, PackagePlus, Plus, Send, Sparkles, Star, Truck, UserRound, Wand2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/api";
import { useT } from "../lib/i18n/client";
import { useDesignG } from "../lib/ui";
import { driverBusy, tourColor, vehicleBusy } from "../lib/helpers";
import { optimizeNotes, optimizeProblems } from "../lib/optimize";
import { useDispatch } from "../lib/store";
import { AddStopsDialog } from "./AddStopsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TourActionsMenu } from "./TourActions";
import { UnassignedStopActions } from "./UnassignedStopActions";
import { TourStatusBadge } from "./StatusBadge";
import { TourEndsDialog, tourEndsSummary } from "./TourEndsDialog";
import { TourDetailSheet } from "./TourDetail";

const selectCls = "h-9 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs focus:border-brand-500 focus:shadow-[var(--shadow-focus)] focus:outline-none g:h-8 g:border-line-2 g:bg-surface-2 g:text-[13px] g:shadow-none g:focus:border-brand-600";

function AssignMenu<T extends { id: string }>({
  kind,
  icon,
  current,
  options,
  busyOf,
  render,
  onPick,
  disabled,
}: {
  kind: "driver" | "vehicle";
  icon: ReactNode;
  current: T | undefined;
  options: T[];
  busyOf: (o: T) => string | null;
  render: (o: T) => string;
  onPick: (o: T | null) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const label = t(`planning.${kind}`);
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <Button variant="secondary" size="sm" className={cn("w-full justify-start g:gap-1.5 g:px-2 g:font-normal g:text-ink-2 g:[&_svg]:text-subtle", !current && "border-nx-amber/30 bg-warning-soft/50 text-warning-ink g:border-dashed g:border-line-3 g:bg-transparent g:text-warning-ink")} aria-label={t("planning.assign.aria", { label, value: current ? render(current) : t("planning.assign.notAssigned") })}>
          {icon}
          <span className="truncate">{current ? render(current) : t(`planning.assign.${kind}`)}</span>
          <ChevronDown className="ms-auto text-subtle g:size-3.5" />
        </Button>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{label}</MenuLabel>
        {options.length === 0 && <MenuItem disabled>{t(kind === "driver" ? "planning.assign.noDrivers" : "planning.assign.noVehicles")}</MenuItem>}
        {options.map((o) => {
          const busy = busyOf(o);
          return (
            <MenuItem key={o.id} disabled={!!busy} hint={busy ?? undefined} onSelect={() => onPick(o)}>
              {render(o)}
            </MenuItem>
          );
        })}
        {current && <MenuItem onSelect={() => onPick(null)}>{t("planning.assign.remove")}</MenuItem>}
      </MenuContent>
    </Menu>
  );
}

function TourCard({ s }: { s: TourSummary }) {
  const { scoped, updateTour, selectTour, optimizeTour, publishTour } = useDispatch();
  const t = useT();
  const [busy, setBusy] = useState<null | "optimize" | "assign">(null);
  const [publishing, setPublishing] = useState(false);
  const [endsOpen, setEndsOpen] = useState(false);
  const drivers = scoped.drivers.filter((d) => d.depotId === s.depot.id && d.active);
  const vehicles = scoped.vehicles.filter((v) => v.depotId === s.depot.id);
  const locked = s.tour.status === "completed";
  const driverBusyLabel = (d: Driver) => {
    const other = driverBusy(scoped, d.id, s.tour.id);
    return other ? t("planning.busyOn", { name: other.name }) : null;
  };
  const vehicleBusyLabel = (v: Vehicle) => {
    const other = vehicleBusy(scoped, v.id, s.tour.id);
    return other ? t("planning.busyOn", { name: other.name }) : null;
  };
  const assign = async (patch: { driverId?: string | null; vehicleId?: string | null }, msg: string) => {
    setBusy("assign");
    try {
      await updateTour(s.tour, patch);
      toast.success(msg);
    } catch (e) {
      toast.error(t("planning.assignFailed"), { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  const optimize = async () => {
    setBusy("optimize");
    try {
      // Tours on the road answer 409 here: they are re-sequenced from the tour detail with a preview.
      const r = (await optimizeTour(s.tour)).result;
      const problems = optimizeProblems(r, t);
      (problems.length ? toast.warning : toast.success)(t("planning.optimizedSaved", { name: s.tour.name }), { description: [...problems, ...optimizeNotes(r, t)].join(" · ") });
    } catch (e) {
      toast.error(t("planning.optimizeFailed"), { description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  const g = useDesignG();
  const color = tourColor(scoped, s.tour.id);
  const endsDialog = endsOpen && <TourEndsDialog tour={s.tour} depot={s.depot} open={endsOpen} onOpenChange={setEndsOpen} />;
  const actionsMenu = <TourActionsMenu item={{ tour: s.tour, depotName: s.depot.name, driverName: s.driver?.displayName ?? null, stopCount: s.total, openStops: s.remaining }} onOpen={() => selectTour(s.tour.id)} />;
  const driverMenu = (
    <AssignMenu
      kind="driver"
      icon={busy === "assign" ? <Loader2 className="animate-spin" /> : <UserRound />}
      current={scoped.drivers.find((d) => d.id === s.tour.driverId)}
      options={drivers}
      busyOf={driverBusyLabel}
      render={(d) => d.displayName}
      disabled={locked || busy !== null}
      onPick={(d) => void assign({ driverId: d?.id ?? null }, d ? t("planning.driverAssigned", { driver: d.displayName, tour: s.tour.name }) : t("planning.driverRemoved", { tour: s.tour.name }))}
    />
  );
  const vehicleMenu = (
    <AssignMenu
      kind="vehicle"
      icon={<Truck />}
      current={scoped.vehicles.find((v) => v.id === s.tour.vehicleId)}
      options={vehicles}
      busyOf={vehicleBusyLabel}
      render={(v) => `${v.label} · ${v.licensePlate}`}
      disabled={locked || busy !== null}
      onPick={(v) => void assign({ vehicleId: v?.id ?? null }, v ? t("planning.vehicleAssigned", { vehicle: v.label, tour: s.tour.name }) : t("planning.vehicleRemoved", { tour: s.tour.name }))}
    />
  );
  const canPublish = !s.tour.publishedAt && !locked;
  const publishButton = canPublish && (
    <Tooltip content={!s.tour.driverId ? t("planning.assignDriverFirst") : s.total === 0 ? t("planning.addStopsFirst") : t("planning.publishHint")}>
      <span>
        <Button size="sm" variant="ghost" onClick={() => setPublishing(true)} disabled={!s.tour.driverId || s.total === 0}>
          <Send /> {t("planning.publish")}
        </Button>
      </span>
    </Tooltip>
  );
  const confirmPublish = (
    <ConfirmDialog
      open={publishing}
      onOpenChange={setPublishing}
      title={t("planning.publishTitle", { name: s.tour.name })}
      description={t("planning.publishDesc", { driver: s.driver?.displayName ?? t("planning.theDriver"), count: s.total })}
      confirmLabel={t("planning.publish")}
      onConfirm={() =>
        publishTour(s.tour).then(
          () => toast.success(t("planning.publishedToast", { name: s.tour.name })),
          (e) => {
            toast.error(t("planning.publishFailed"), { description: errorMessage(e) });
            throw e;
          },
        )
      }
    />
  );

  /*
   * Phase G: one row of a bordered tour table instead of a card. Same controls in the same order
   * (name → tour detail, start/end dialog, status, actions menu, driver, vehicle, figures, optimize,
   * publish). One line from ~768 px container width; below it the row wraps into a 2-column grid.
   */
  if (g)
    return (
      <div
        role="group"
        aria-label={t("planning.tourName", { name: s.tour.name })}
        className="relative grid grid-cols-2 items-center gap-x-3 gap-y-2 py-2 pe-2 ps-4 transition-colors hover:bg-[var(--hover)] @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] @3xl:gap-y-0"
      >
        <span className="absolute inset-y-2 start-0 w-[3px] rounded-e" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0">
          <button onClick={() => selectTour(s.tour.id)} className="block max-w-full truncate text-[13px] font-medium text-ink hover:text-brand-700 focus-visible:underline focus-visible:outline-none">
            {s.tour.name}
          </button>
          <div className="flex min-w-0 items-center gap-1 text-[12px] text-muted">
            <span className="tabular shrink-0">{formatClock(s.tour.plannedStartMinute)}</span>
            <span aria-hidden="true">·</span>
            <button onClick={() => setEndsOpen(true)} disabled={locked} className="min-w-0 truncate hover:text-ink disabled:opacity-60" title={t("planning.endsTooltip")}>
              {tourEndsSummary(s.tour, s.depot, t)}
            </button>
          </div>
          {endsDialog}
        </div>
        <div className="flex min-w-0 flex-col items-end @3xl:items-start">
          <TourStatusBadge status={s.status} certainty={s.delayCertainty} />
          <span className="truncate text-[12px] leading-4 text-muted">{s.tour.publishedAt ? t("planning.published") : t("common.notPublished")}</span>
        </div>
        <div className="min-w-0">{driverMenu}</div>
        <div className="min-w-0">{vehicleMenu}</div>
        <div className="min-w-0 text-[12px] leading-4 text-muted @3xl:text-end">
          <div className="tabular text-[13px] text-ink-2">{t("common.stops", { count: s.total })}</div>
          <div className="tabular truncate">
            {t("planning.openN", { n: s.remaining })} · {t("planning.pickupsN", { count: s.pickups })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-0.5">
          <Tooltip content={t("planning.optimize")}>
            <span>
              <Button size="icon-sm" variant="ghost" onClick={optimize} disabled={busy !== null || locked || s.remaining < 2} aria-label={t("planning.optimize")}>
                {busy === "optimize" ? <Loader2 className="animate-spin" /> : <Sparkles />}
              </Button>
            </span>
          </Tooltip>
          {publishButton}
          {actionsMenu}
        </div>
        {confirmPublish}
      </div>
    );

  return (
    <Card interactive className="relative flex flex-col gap-3 overflow-hidden p-4" role="group" aria-label={t("planning.tourName", { name: s.tour.name })}>
      <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button onClick={() => selectTour(s.tour.id)} className="text-[15px] font-semibold text-ink hover:text-brand-700">
            {s.tour.name}
          </button>
          <div className="text-xs text-muted">
            {t("planning.depotStart", { depot: s.depot.name, time: formatClock(s.tour.plannedStartMinute) })}
          </div>
          <button
            onClick={() => setEndsOpen(true)}
            disabled={locked}
            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-ink-2 hover:text-brand-700 disabled:opacity-60"
            title={t("planning.endsTooltip")}
          >
            <MapPinned className="size-3.5 shrink-0" />
            <span className="truncate">{tourEndsSummary(s.tour, s.depot, t)}</span>
          </button>
          {endsDialog}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <TourStatusBadge status={s.status} certainty={s.delayCertainty} />
            {actionsMenu}
          </div>
          {s.tour.publishedAt ? <Badge tone="success">{t("planning.published")}</Badge> : <Badge tone="outline">{t("common.notPublished")}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {driverMenu}
        {vehicleMenu}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular">
          {t("common.stops", { count: s.total })} · {t("planning.openN", { n: s.remaining })} · {t("planning.pickupsN", { count: s.pickups })}
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={optimize} disabled={busy !== null || locked || s.remaining < 2}>
            {busy === "optimize" ? <Loader2 className="animate-spin" /> : <Sparkles />} {t("planning.optimize")}
          </Button>
          {publishButton}
        </div>
      </div>
      {confirmPublish}
    </Card>
  );
}

function NewTourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { scoped, depotId, createTour, selectTour, date } = useDispatch();
  const t = useT();
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
      const created = await createTour({ depotId: depot, plannedStartMinute: startMinute, driverId: driver || null, vehicleId: vehicle || null });
      toast.success(t("planning.tourCreated", { name: created.name }), { description: t("planning.tourCreatedDesc") });
      onOpenChange(false);
      setDriver("");
      setVehicle("");
      selectTour(created.id);
    } catch (e) {
      toast.error(t("planning.tourNotCreated"), { description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={t("planning.newTour")}
      description={t("planning.plannedFor", { date })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || startMinute === null || !depot}>
            {busy && <Loader2 className="animate-spin" />}
            {t("planning.createTour")}
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
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted">
          {t("planning.depot")}
          <select className={selectCls} value={depot} onChange={(e) => (setDepot(e.target.value), setDriver(""), setVehicle(""))}>
            {scoped.depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted">
          {t("planning.startTime")}
          <input dir="ltr" type="time" className={cn(selectCls, startMinute === null && "border-danger")} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={startMinute === null} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted">
          {t("planning.driver")}
          <select className={selectCls} value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">{t("planning.assignLater")}</option>
            {freeDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted g:text-[12px]">{t("planning.available", { n: freeDrivers.length })}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2 g:gap-1 g:text-[12px] g:font-normal g:text-muted">
          {t("planning.vehicle")}
          <select className={selectCls} value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="">{t("planning.assignLater")}</option>
            {freeVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} · {v.licensePlate}
              </option>
            ))}
          </select>
          <span className="text-2xs font-normal text-muted g:text-[12px]">{t("planning.available", { n: freeVehicles.length })}</span>
        </label>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

export function PlanningView() {
  const { data, summaries, assignStops, setPriority, date, depotId, scoped, optimizePlan, session } = useDispatch();
  const t = useT();
  // /planning?new=1 (Overview → "New tour") opens the dialog directly.
  const params = useSearchParams();
  const [newOpen, setNewOpen] = useState(() => params?.get("new") === "1" && can(session.role, "tours.manage"));
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
  const driverRows = useMemo(() => data.drivers.map((dr) => ({ dr, busyTour: driverBusy(data, dr.id) })), [data]);
  const freeVehicles = data.vehicles.filter((v) => !vehicleBusy(data, v.id));
  const canManage = session.role !== "driver";
  const g = useDesignG();

  const runPlan = async () => {
    if (!depot) return;
    setPlanBusy(true);
    try {
      const r = await optimizePlan(
        plannedHere.map((s) => s.tour.id),
        true,
      );
      toast.success(t("planning.planToast", { count: plannedHere.length, depot: depot.name }), {
        description: [
          r.matrixSource === "osrm" ? t("planning.roadTimes") : t("planning.straightTimes"),
          r.unassignedStopIds.length ? t("planning.planLeftUnassigned", { n: r.unassignedStopIds.length }) : null,
          r.unlocatedStopIds?.length ? t("planning.planUnlocated", { n: r.unlocatedStopIds.length }) : null,
          r.locationErrors?.length ? t("planning.planLocationErrors", { n: r.locationErrors.length }) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } catch (e) {
      toast.error(t("planning.planFailed"), { description: errorMessage(e) });
    } finally {
      setPlanBusy(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink g:text-[20px] g:font-semibold g:tracking-[-0.015em]">{t("planning.title")}</h1>
            <p className="mt-1 text-sm text-ink-2 g:mt-0.5 g:text-[13px] g:text-muted">
              {date} · {depot ? depot.name : t("planning.depotsN", { count: data.depots.length })} · {t("planning.openTours", { count: openTours.length })}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip content={!depot ? t("planning.selectDepotFirst") : plannedHere.length === 0 ? t("planning.noPlannedTours") : t("planning.planHint")}>
                <span>
                  <Button variant="secondary" onClick={runPlan} disabled={!depot || plannedHere.length === 0 || planBusy}>
                    {planBusy ? <Loader2 className="animate-spin" /> : <Wand2 />} {t("planning.optimizePlan")}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip content={depot ? t("planning.addStopsHint", { depot: depot.name }) : t("planning.selectDepotFirst")}>
                <span>
                  <Button variant="secondary" onClick={() => setAddOpen(true)} disabled={!depot}>
                    <PackagePlus /> {t("planning.addStops")}
                  </Button>
                </span>
              </Tooltip>
              <Button variant="primary" onClick={() => setNewOpen(true)} disabled={scoped.depots.length === 0}>
                <Plus /> {t("planning.newTour")}
              </Button>
            </div>
          )}
        </div>

        {summaries.length === 0 && data.unassigned.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarX2 />}
              title={t("planning.emptyTitle", { date })}
              description={t("planning.emptyDesc")}
              action={
                canManage && (
                  <Button variant="primary" onClick={() => setNewOpen(true)}>
                    <Plus /> {t("planning.newTour")}
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className={cn("grid grid-cols-1 gap-4", g ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-[minmax(0,1fr)_380px]")}>
            <section aria-label={t("planning.toursAria")} className="flex flex-col gap-3">
              {openTours.length === 0 ? (
                <Card className="p-6 text-center text-[13px] text-muted g:p-5">{t("planning.noOpenTours")}</Card>
              ) : g ? (
                // Phase G: one bordered surface, a row per tour divided by hairlines.
                <div className="@container overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="divide-y divide-line">
                    {openTours.map((s) => (
                      <TourCard key={s.tour.id} s={s} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {openTours.map((s) => (
                    <TourCard key={s.tour.id} s={s} />
                  ))}
                </div>
              )}
              {doneTours.length > 0 && (
                <p className="text-xs text-muted">
                  {t("planning.completedHidden", { count: doneTours.length, names: doneTours.map((s) => s.tour.name).join(", ") })}{" "}
                  <Link href="/list?view=all" className="font-semibold text-brand-700 hover:underline g:font-medium">
                    {t("planning.manageInTours")}
                  </Link>
                </p>
              )}
            </section>

            <div className="flex flex-col gap-4">
              <Card className="overflow-hidden">
                <CardHeader
                  title={t("planning.unassignedTitle", { n: data.unassigned.length })}
                  description={t("planning.unassignedDesc")}
                  actions={
                    <div className="flex items-center gap-1.5">
                    <UnassignedStopActions ids={[...selected]} onDone={() => setSelected(new Set())} />
                    <Menu>
                      <MenuTrigger asChild disabled={selected.size === 0 || targetTours.length === 0 || assignBusy}>
                        <Button size="sm" variant="primary">
                          {assignBusy ? <Loader2 className="animate-spin" /> : <PackagePlus />} {t("planning.assign")}
                        </Button>
                      </MenuTrigger>
                      <MenuContent className="w-56">
                        <MenuLabel>{t("planning.assignToTour", { n: selected.size })}</MenuLabel>
                        {targetTours.map((s) => (
                          <MenuItem
                            key={s.tour.id}
                            hint={t("planning.openN", { n: s.remaining })}
                            onSelect={async () => {
                              setAssignBusy(true);
                              try {
                                await assignStops([...selected], s.tour.id);
                                toast.success(t("planning.assignedToast", { count: selected.size, tour: s.tour.name }), { description: t("planning.assignedDesc") });
                                setSelected(new Set());
                              } catch (e) {
                                toast.error(t("planning.stopsNotAssigned"), { description: errorMessage(e) });
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
                    </div>
                  }
                />
                {selected.size > 0 && selectedDepots.size > 1 && <p className="border-b border-line bg-warning-soft px-4 py-2 text-xs text-warning-ink g:bg-transparent g:px-3 g:py-1.5">{t("planning.mixedDepots")}</p>}
                {selected.size > 0 && selectedDepots.size === 1 && targetTours.length === 0 && <p className="border-b border-line bg-warning-soft px-4 py-2 text-xs text-warning-ink g:bg-transparent g:px-3 g:py-1.5">{t("planning.noOpenTourInDepot")}</p>}
                {data.unassigned.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-muted g:py-5">{t("planning.allPlanned")}</p>
                ) : (
                  <ul className="max-h-[420px] divide-y divide-line overflow-y-auto g:max-h-[460px]">
                    {data.unassigned.map((u) => (
                      <li key={u.id} className={cn("flex items-center gap-3 px-4 py-2.5 g:gap-2.5 g:px-3 g:py-1.5 g:hover:bg-[var(--hover)]", selected.has(u.id) && "bg-brand-50/50 g:bg-[var(--selected)] g:hover:bg-[var(--selected)]")}>
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
                          label={t("planning.selectStop", { name: u.recipientName ?? u.address.street, address: `${u.address.street} ${u.address.houseNumber ?? ""}`.trim() })}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-ink g:font-normal">{u.recipientName ?? u.address.street}</span>
                            {u.type === "pickup" && <ArrowUpFromLine className="size-3.5 shrink-0 text-nx-violet-text g:size-3 g:text-muted" aria-label={t("common.stopType.pickup")} />}
                          </div>
                          <div className="truncate text-2xs text-muted g:text-[12px]">
                            {scoped.depots.find((x) => x.id === u.depotId)?.name} · {u.address.street} {u.address.houseNumber}
                            {u.timeWindow && ` · ${formatClock(u.timeWindow.start)}–${formatClock(u.timeWindow.end)}`}
                          </div>
                        </div>
                        <button
                          onClick={() => setPriority(u.id, !u.priority).catch((e) => toast.error(t("planning.priorityNotSaved"), { description: errorMessage(e) }))}
                          aria-pressed={u.priority}
                          aria-label={u.priority ? t("planning.removePriorityFrom", { name: u.recipientName ?? u.address.street }) : t("planning.markPriorityName", { name: u.recipientName ?? u.address.street })}
                          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-2 g:size-7 g:hover:bg-[var(--selected)]"
                        >
                          <Star className={cn("size-4 g:size-[15px]", u.priority ? "fill-nx-amber text-nx-amber g:fill-warning g:text-warning" : "text-subtle")} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="overflow-hidden">
                <CardHeader title={t("planning.drivers")} description={t("planning.available", { n: driverRows.filter((r) => !r.busyTour && r.dr.active).length })} />
                <ul className="divide-y divide-line">
                  {driverRows.map(({ dr, busyTour }) => (
                    <li key={dr.id} className="flex items-center gap-3 px-4 py-2.5 g:gap-2.5 g:px-3 g:py-1.5 g:hover:bg-[var(--hover)]">
                      <Avatar name={dr.displayName} size="sm" className="g:size-6 g:text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-ink g:font-normal">{dr.displayName}</div>
                        <div className="text-2xs text-muted g:text-[12px]">
                          {scoped.depots.find((x) => x.id === dr.depotId)?.name ?? t("planning.noDepot")} · {t("planning.maxShift", { h: Math.round(dr.maxShiftMinutes / 60) })}
                        </div>
                      </div>
                      {!dr.active ? (
                        <Badge>{t("planning.inactive")}</Badge>
                      ) : busyTour ? (
                        <Badge tone="brand">{busyTour.name}</Badge>
                      ) : (
                        <Badge tone="success" dot>
                          {t("planning.availableBadge")}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader title={t("planning.vehicles")} description={t("planning.vehiclesAvailable", { free: freeVehicles.length, total: data.vehicles.length })} />
                <ul className="divide-y divide-line">
                  {data.vehicles.map((v) => {
                    const busyTour = vehicleBusy(data, v.id);
                    return (
                      <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 g:gap-2.5 g:px-3 g:py-1.5 g:hover:bg-[var(--hover)]">
                        <span className="inline-flex size-7 items-center justify-center rounded-md bg-surface-2 text-ink-2 g:hidden">
                          <Truck className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink g:font-normal">{v.label}</div>
                          <div className="text-2xs text-muted g:text-[12px]">
                            {v.licensePlate} · {v.capacityParcels != null ? t("common.parcels", { count: v.capacityParcels }) : t("planning.parcelsUnknown")}
                          </div>
                        </div>
                        {busyTour ? (
                          <Badge tone="brand">{busyTour.name}</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            {t("planning.availableBadge")}
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
      {depot && <AddStopsDialog open={addOpen} onOpenChange={setAddOpen} target={{ depotId: depot.id }} targetLabel={t("planning.unassignedTarget", { depot: depot.name })} defaultCity={depot.address.city} />}
      <TourDetailSheet />
    </div>
  );
}
