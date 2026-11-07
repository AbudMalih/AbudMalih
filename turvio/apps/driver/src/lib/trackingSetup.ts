import { auth } from "../store/tourStore";
import { defineTrackingTask, setTrackingClient } from "./tracking";

/**
 * Imported first thing by the root layout: the background location task must be defined at
 * module load, also when Android/iOS start the JS bundle without UI to deliver positions.
 */
setTrackingClient(auth);
defineTrackingTask();
