import { create } from "zustand";

// Tracks "the HCM told us X, did a later real refetch confirm X?" per
// balance row (TRD §6.2/§6.3). Lives outside TanStack Query because it
// compares two points in time, not a single cached value.
export const useBalanceIntegrityStore = create((set) => ({
  entries: {},
  setExpected: (key, expected) =>
    set((state) => ({ entries: { ...state.entries, [key]: { expected, suspect: false } } })),
  confirm: (key, actual) =>
    set((state) => {
      const entry = state.entries[key];
      if (!entry) return state;
      if (entry.expected === actual) {
        const { [key]: _resolved, ...rest } = state.entries;
        return { entries: rest };
      }
      return { entries: { ...state.entries, [key]: { ...entry, suspect: true } } };
    }),
}));
