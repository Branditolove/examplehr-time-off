"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decideRequest } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

// Pessimistic on purpose (TRD §3.2) — no onMutate optimistic patch. The
// component is responsible for forcing a fresh balance read before calling
// this, so the manager never decides on a number that wasn't just confirmed.
export function useDecideRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision }) => decideRequest(id, decision),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingRequests() });
      if (data.balance) {
        queryClient.setQueryData(
          queryKeys.balance(data.balance.employeeId, data.balance.locationId),
          data.balance
        );
      }
    },
  });
}
