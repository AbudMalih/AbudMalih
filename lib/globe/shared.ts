/**
 * Screen-space anchors published by the fixed globe layer every time it
 * renders, so DOM layers (the hero's red period) can hand over to the
 * globe's route origin precisely. Viewport pixels.
 */
export const globeAnchor = {
  /** Route origin (first waypoint, East Asia). */
  x: 0,
  y: 0,
  front: false,
  ready: false,
};
