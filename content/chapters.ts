/**
 * Homepage chapter map. `len` / `lenM` = scroll length in viewport heights
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
  label: string;
  len: number;
  lenM: number;
};

export const CHAPTERS: Chapter[] = [
  { id: "hero", index: "00", label: "Trade without borders", len: 3.2, lenM: 2.6 },
  { id: "source", index: "01", label: "From source to market", len: 3.2, lenM: 2.6 },
  { id: "transport", index: "02", label: "European transport", len: 3.8, lenM: 3.0 },
  { id: "warehouse", index: "03", label: "Distribution", len: 2.6, lenM: 2.1 },
  { id: "brands", index: "04", label: "We build brands", len: 3.0, lenM: 2.4 },
  { id: "chain", index: "05", label: "The chain", len: 3.4, lenM: 3.0 },
  { id: "luviscent", index: "06", label: "LUVISCENT®", len: 3.4, lenM: 2.8 },
  { id: "ecosystem", index: "07", label: "Ecosystem", len: 3.0, lenM: 2.6 },
  { id: "closing", index: "08", label: "Let's do business", len: 2.6, lenM: 2.2 },
];
