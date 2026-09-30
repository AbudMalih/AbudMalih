import type { MediaItem, MediaKey } from "./types";

/**
 * Media registry – the single place to swap in real JARBOU photography.
 *
 * PLACEHOLDER NOTICE: No approved photographs have been supplied yet. Every
 * slot below is marked `placeholder: true` and renders a schematic line
 * illustration instead of a photo. To replace: put the image into
 * /public/media/…, set `src`, `width`, `height`, a descriptive `alt`, and
 * `placeholder: false`.
 *
 * Never use imagery that implies a specific JARBOU site, vehicle or employee
 * unless it actually shows one.
 */
export const media: Record<MediaKey, MediaItem> = {
  "service-disposition": { src: null, alt: "Schematische Darstellung: Disposition von Fahrern, Fahrzeugen und Touren", placeholder: true },
  "service-routes": { src: null, alt: "Schematische Darstellung: Tourennetz mit Stopps", placeholder: true },
  "service-delivery": { src: null, alt: "Schematische Darstellung: Zustellung auf der letzten Meile", placeholder: true },
  "service-quality": { src: null, alt: "Schematische Darstellung: Qualitätskontrolle anhand von Kennzahlen", placeholder: true },
  "service-fleet": { src: null, alt: "Schematische Darstellung: Fuhrpark aus Transportern und LKW", placeholder: true },
  "service-operations": { src: null, alt: "Schematische Darstellung: Operative Teams im Einsatz", placeholder: true },
};
