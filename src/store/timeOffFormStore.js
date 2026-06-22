import { create } from "zustand";

// Pure client state (TRD §2.1.1) — the in-progress request draft. Server
// state (balances, requests) lives in TanStack Query, never here.
export const useTimeOffFormStore = create((set) => ({
  locationId: null,
  days: 0,
  startDate: "",
  endDate: "",
  setField: (field, value) => set({ [field]: value }),
  reset: () => set({ locationId: null, days: 0, startDate: "", endDate: "" }),
}));
