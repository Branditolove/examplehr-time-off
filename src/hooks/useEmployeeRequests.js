"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEmployeeRequests } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

export function useEmployeeRequests(employeeId) {
  return useQuery({
    queryKey: queryKeys.employeeRequests(employeeId),
    queryFn: () => fetchEmployeeRequests(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
