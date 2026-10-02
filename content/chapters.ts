/**
 * Homepage chapter map (labels: content/i18n). `len` / `lenM` = scroll distance in viewport heights
 * (desktop / mobile) while the chapter is on stage. Order = story order.
 */
export type ChapterId =
  | "hero"
  | "source"
  | "transport"
  | "warehouse"
  | "brands"
  | "chain"
  | "commerce"
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
  { id: "hero", index: "00", len: 2.4, lenM: 1.9 },
  { id: "source", index: "01", len: 2.3, lenM: 1.8 },
  { id: "transport", index: "02", len: 2.7, lenM: 2.1 },
  { id: "warehouse", index: "03", len: 1.8, lenM: 1.4 },
  { id: "brands", index: "04", len: 1.9, lenM: 1.5 },
  { id: "chain", index: "05", len: 2.3, lenM: 1.9 },
  { id: "commerce", index: "06", len: 3.4, lenM: 2.8 },
  { id: "luviscent", index: "07", len: 2.3, lenM: 1.9 },
  { id: "ecosystem", index: "08", len: 2.1, lenM: 1.7 },
  { id: "closing", index: "09", len: 1.4, lenM: 1.2 },
];
