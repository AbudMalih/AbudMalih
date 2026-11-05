"use client";

import {
  dispatchKpis,
  filterByDepot,
  pickupRows,
  summarizeTours,
  type DispatchDataset,
  type DispatchKpis,
  type PickupRow,
  type Tour,
  type TourSummary,
} from "@turvio/shared";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { EMPTY_DRAFT, applyDraft, createDraftTour, draftChangeCount, type PlanDraft } from "./draft";

export interface SessionInfo {
  userName: string;
  email: string;
  role: string;
  organizationName: string;
  companyWide: boolean;
}

interface DispatchState {
  session: SessionInfo;
  /** All data the user may see (already scoped server-side), with the draft applied. */
  scoped: DispatchDataset;
  /** `scoped` narrowed to the selected depot and date. */
  data: DispatchDataset;
  summaries: TourSummary[];
  kpis: DispatchKpis;
  pickups: PickupRow[];
  depotId: string | null;
  setDepotId: (id: string | null) => void;
  date: string;
  setDate: (date: string) => void;
  /** True when the selected date has synthetic data. */
  hasDataForDate: boolean;
  selectedTourId: string | null;
  selectedStopId: string | null;
  selectTour: (id: string | null) => void;
  selectStop: (id: string | null, tourId?: string | null) => void;
  draft: PlanDraft;
  draftChanges: number;
  createTour: (input: { depotId: string; startMinute: number; driverId: string | null; vehicleId: string | null }) => Tour;
  assign: (tourId: string, patch: { driverId?: string | null; vehicleId?: string | null }) => void;
  moveStops: (stopIds: string[], tourId: string) => void;
  setPriority: (stopId: string, value: boolean) => void;
  setOrder: (tourId: string, stopIds: string[]) => void;
  resetDraft: () => void;
}

const Ctx = createContext<DispatchState | null>(null);

const emptyFor = (d: DispatchDataset): DispatchDataset => ({ ...d, tours: [], stops: [], unassigned: [] });

export function DispatchProvider({ base, session, children }: { base: DispatchDataset; session: SessionInfo; children: ReactNode }) {
  const singleDepot = base.depots.length === 1 ? base.depots[0]!.id : null;
  const [depotId, setDepotIdState] = useState<string | null>(singleDepot);
  const [date, setDate] = useState(base.date);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT);

  const scoped = useMemo(() => applyDraft(base, draft), [base, draft]);
  const hasDataForDate = date === base.date;
  const data = useMemo(() => {
    const byDepot = filterByDepot(scoped, depotId);
    return hasDataForDate ? byDepot : emptyFor(byDepot);
  }, [scoped, depotId, hasDataForDate]);
  const summaries = useMemo(() => summarizeTours(data), [data]);
  const kpis = useMemo(() => dispatchKpis(data, summaries), [data, summaries]);
  const pickups = useMemo(() => pickupRows(data, summaries), [data, summaries]);

  const setDepotId = useCallback(
    (id: string | null) => {
      // Never allow "all depots" for a user limited to one depot.
      setDepotIdState(singleDepot ?? id);
      setSelectedTourId(null);
      setSelectedStopId(null);
    },
    [singleDepot],
  );

  const value: DispatchState = {
    session,
    scoped,
    data,
    summaries,
    kpis,
    pickups,
    depotId,
    setDepotId,
    date,
    setDate,
    hasDataForDate,
    selectedTourId,
    selectedStopId,
    selectTour: (id) => {
      setSelectedTourId(id);
      setSelectedStopId(null);
    },
    selectStop: (id, tourId) => {
      if (tourId !== undefined) setSelectedTourId(tourId);
      setSelectedStopId(id);
    },
    draft,
    draftChanges: draftChangeCount(draft),
    createTour: (input) => {
      const tour = createDraftTour(scoped, input);
      setDraft((d) => ({ ...d, newTours: [...d.newTours, tour] }));
      return tour;
    },
    assign: (tourId, patch) => setDraft((d) => ({ ...d, assignments: { ...d.assignments, [tourId]: { ...d.assignments[tourId], ...patch } } })),
    moveStops: (stopIds, tourId) => setDraft((d) => ({ ...d, moved: { ...d.moved, ...Object.fromEntries(stopIds.map((id) => [id, tourId])) } })),
    setPriority: (stopId, v) => setDraft((d) => ({ ...d, priority: { ...d.priority, [stopId]: v } })),
    setOrder: (tourId, ids) => setDraft((d) => ({ ...d, order: { ...d.order, [tourId]: ids } })),
    resetDraft: () => setDraft(EMPTY_DRAFT),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDispatch(): DispatchState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDispatch must be used inside <DispatchProvider>");
  return v;
}
