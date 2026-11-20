import { auth, useTourStore } from "../store/tourStore";
import { defineTrackingTask, setTrackingClient, setTrackingUser } from "./tracking";

/**
 * Imported first thing by the root layout: the background location task must be defined at
 * module load, also when Android/iOS start the JS bundle without UI to deliver positions.
 */
setTrackingClient(auth);
setTrackingUser(() => useTourStore.getState().user?.id ?? null);
defineTrackingTask();
