/**
 * Homepage chapter map (labels: content/i18n). `len` / `lenM` = scroll length in viewport heights
 * (desktop / mobile) while the chapter is on stage. Order = story order.
 */
export type ChapterId =
  | "hero"
  | "source"
  | "transport"
  | "warehouse"
  | "brands"
  | "chain"
  | "luviscent"
  | "ecosystem"
  | "closing";

export type Chapter = {
  id: ChapterId;
  index: string;
  len: number;
  lenM: number;
};

export const CHAPTERS: Chapter[] = [
  { id: "hero", index: "00", len: 3.2, lenM: 2.6 },
  { id: "source", index: "01", len: 3.2, lenM: 2.6 },
  { id: "transport", index: "02", len: 3.8, lenM: 3.0 },
  { id: "warehouse", index: "03", len: 2.6, lenM: 2.1 },
  { id: "brands", index: "04", len: 3.0, lenM: 2.4 },
  { id: "chain", index: "05", len: 4.8, lenM: 4.0 },
  { id: "luviscent", index: "06", len: 3.8, lenM: 3.0 },
  { id: "ecosystem", index: "07", len: 3.0, lenM: 2.6 },
  { id: "closing", index: "08", len: 2.6, lenM: 2.2 },
];
