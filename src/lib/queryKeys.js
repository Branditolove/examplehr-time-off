// Shared so batch hydration (useEmployeeBalances) writes to the same cache
// entries that per-location reads (useBalance) look up. See TRD §4.3.
export const queryKeys = {
  balance: (employeeId, locationId) => ["balance", employeeId, locationId],
  balancesBatch: (employeeId) => ["balances", "batch", employeeId ?? "all"],
  pendingRequests: () => ["requests", "pending"],
  employeeRequests: (employeeId) => ["requests", "employee", employeeId],
};
