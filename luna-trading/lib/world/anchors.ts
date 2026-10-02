import type { V3 } from "./builder";

export const FACADE_Z = -650;

/** 3D anchor points for environment-integrated labels, with journey windows. */
export const ANCHOR_DEFS: { id: string; p: V3; from: number; to: number }[] = [
  { id: "germany", p: [0, 15.6, FACADE_Z], from: 0.585, to: 0.665 },
  { id: "eu", p: [-7.3, 10.7, -676], from: 0.655, to: 0.745 },
  { id: "ecommerce", p: [7.3, 7.3, -699], from: 0.69, to: 0.785 },
  { id: "b2b", p: [-7.3, 4.0, -716], from: 0.73, to: 0.815 },
];
