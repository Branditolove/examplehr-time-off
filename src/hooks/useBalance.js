"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBalance } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

// staleTime/refetchInterval encode TRD §4.1 and §5.1: 30s of trust before a
// balance is considered stale, background polling while mounted for reconciliation.
export function useBalance(employeeId, locationId) {
  return useQuery({
    queryKey: queryKeys.balance(employeeId, locationId),
    queryFn: () => fetchBalance(employeeId, locationId),
    enabled: Boolean(employeeId && locationId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
