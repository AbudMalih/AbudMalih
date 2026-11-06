import { create } from "zustand";
import type { ImportDraft } from "../lib/photoImport";

/**
 * In-memory session of one "stops from photo" import. Deliberately NOT persisted:
 * extracted names and addresses live only until the driver saves or leaves.
 */
interface ImportState {
  drafts: ImportDraft[];
  notes: string[];
  images: number;
  setDrafts: (drafts: ImportDraft[]) => void;
  update: (key: string, patch: Partial<ImportDraft>) => void;
  addNotes: (notes: string[]) => void;
  nextImage: () => number;
  reset: () => void;
}

export const useImportStore = create<ImportState>((set, get) => ({
  drafts: [],
  notes: [],
  images: 0,
  setDrafts: (drafts) => set({ drafts }),
  update: (key, patch) => set({ drafts: get().drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)) }),
  addNotes: (notes) => set({ notes: [...new Set([...get().notes, ...notes])] }),
  nextImage: () => {
    const n = get().images + 1;
    set({ images: n });
    return n;
  },
  reset: () => set({ drafts: [], notes: [], images: 0 }),
}));
