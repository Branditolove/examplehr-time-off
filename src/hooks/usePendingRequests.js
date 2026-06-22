"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPendingRequests } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

export function usePendingRequests() {
  return useQuery({
    queryKey: queryKeys.pendingRequests(),
    queryFn: fetchPendingRequests,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
