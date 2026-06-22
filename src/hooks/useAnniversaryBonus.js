"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerAnniversaryBonus } from "@/lib/hcm/client";
import { queryKeys } from "@/lib/queryKeys";

export function useAnniversaryBonus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerAnniversaryBonus,
    onSuccess: (balance) => {
      queryClient.setQueryData(queryKeys.balance(balance.employeeId, balance.locationId), balance);
    },
  });
}
