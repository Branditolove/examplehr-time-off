"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBalancesBatch } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

// For initial hydration only (TRD §4.3) — long staleTime because this endpoint
// is the expensive one. Each row hydrates its own per-location cache entry so
// useBalance reads fresh data immediately instead of refetching one-by-one.
export function useEmployeeBalances(employeeId) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.balancesBatch(employeeId),
    queryFn: async () => {
      const balances = await fetchBalancesBatch(employeeId);
      for (const balance of balances) {
        queryClient.setQueryData(queryKeys.balance(balance.employeeId, balance.locationId), balance);
      }
      return balances;
    },
    enabled: Boolean(employeeId),
    staleTime: 5 * 60_000,
  });
}
