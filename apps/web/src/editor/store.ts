import { create } from "zustand";
import type { Graph } from "@floxi/shared";
const empty: Graph = { schemaVersion: 1, nodes: [], edges: [] };
type State = {
  graph: Graph;
  past: Graph[];
  future: Graph[];
  reset: (g: Graph) => void;
  change: (g: Graph, record?: boolean) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
};
export const useEditor = create<State>((set, get) => ({
  graph: empty,
  past: [],
  future: [],
  reset: (graph) => set({ graph, past: [], future: [] }),
  change: (graph, record = true) =>
    set((s) => ({
      graph,
      past: record ? [...s.past, s.graph].slice(-100) : s.past,
      future: record ? [] : s.future,
    })),
  checkpoint: () =>
    set((s) => ({ past: [...s.past, s.graph].slice(-100), future: [] })),
  undo: () => {
    const s = get(),
      g = s.past.at(-1);
    if (g)
      set({
        graph: g,
        past: s.past.slice(0, -1),
        future: [s.graph, ...s.future],
      });
  },
  redo: () => {
    const s = get(),
      g = s.future[0];
    if (g)
      set({ graph: g, past: [...s.past, s.graph], future: s.future.slice(1) });
  },
}));
