"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitTimeOffRequest } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

// Verification delay for TRD §6.2 — gives the HCM time to "settle" before we
// refetch and check whether the persisted balance matches what it claimed.
const VERIFY_DELAY_MS = 4000;

export function useSubmitTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitTimeOffRequest,
    // Optimistic: TRD §3.1 — employee's own balance, low cost to revert.
    onMutate: async ({ employeeId, locationId, days }) => {
      const key = queryKeys.balance(employeeId, locationId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      if (previous) {
        queryClient.setQueryData(key, { ...previous, balance: previous.balance - days });
      }
      return { previous, key };
    },
    onError: (error, _variables, context) => {
      // Prefer the authoritative balance the HCM sent with the rejection
      // (insufficient_balance/conflict both include it) over the pre-mutation
      // snapshot — for a conflict specifically, "previous" is exactly the
      // stale value that caused the conflict in the first place.
      const authoritative = error?.body?.balance;
      if (authoritative) queryClient.setQueryData(context.key, authoritative);
      else if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(context.key, data.balance);
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingRequests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.employeeRequests(variables.employeeId) });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: context.key });
      }, VERIFY_DELAY_MS);
    },
  });
}
