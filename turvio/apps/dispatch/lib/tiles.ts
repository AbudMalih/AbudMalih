/**
 * Map tiles (Leaflet). The public OpenStreetMap tile server is for light use only (OSMF tile usage
 * policy); a production deployment sets NEXT_PUBLIC_MAP_TILE_URL to its tile provider. The CSP in
 * proxy.ts allows exactly this origin for images.
 */
export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
