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

  /*
   * PHOTOGRAPHY SLOTS – only real, approved JARBOU photos.
   * No AI-generated people, no generic stock photos. Until `src` is set the
   * slot renders nothing and the layout stays complete without it.
   * Recommended: landscape 3:2, min. 2400 px wide, JPG/WebP, in /public/media/.
   */
  "photo-truck-40t": { src: null, alt: "JARBOU-Sattelzug", placeholder: true },
  "photo-vans": { src: null, alt: "JARBOU-Transporterflotte", placeholder: true },
  "photo-drivers": { src: null, alt: "Fahrerinnen und Fahrer von JARBOU", placeholder: true },
  "photo-dispatch": { src: null, alt: "Disposition bei JARBOU", placeholder: true },
  "photo-facilities": { src: null, alt: "JARBOU-Logistikstandort", placeholder: true },
  "photo-offices": { src: null, alt: "JARBOU-Büro", placeholder: true },
  "photo-team": { src: null, alt: "Das JARBOU-Team", placeholder: true },
  "photo-loading": { src: null, alt: "Beladung bei JARBOU", placeholder: true },
};
