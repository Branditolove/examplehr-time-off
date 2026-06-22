"use client";

import { useState } from "react";
import { useBalance } from "@/hooks/useBalance";
import { useDecideRequest } from "@/hooks/useDecideRequest";
import { getEmployeeName, getLocationName } from "@/lib/hcm/lookup";
import { card } from "@/lib/ui";
import { BalanceContext } from "./BalanceContext";
import { ApproveDenyButtons } from "./ApproveDenyButtons";

// Pessimistic by design (TRD §3.2): approving forces a fresh balance read
// first. If it differs from what the manager last saw, require an explicit
// second confirmation instead of approving against a number that just moved.
export function RequestRow({ request }) {
  const balanceQuery = useBalance(request.employeeId, request.locationId);
  const decideMutation = useDecideRequest();
  const [phase, setPhase] = useState("idle"); // idle | revalidating | stale-confirm
  const [staleSnapshot, setStaleSnapshot] = useState(null);

  async function handleApproveClick() {
    setPhase("revalidating");
    const previous = balanceQuery.data?.balance;
    const result = await balanceQuery.refetch();
    const current = result.data?.balance;

    if (previous !== undefined && current !== undefined && current !== previous) {
      setStaleSnapshot({ previous, current });
      setPhase("stale-confirm");
    } else {
      setPhase("idle");
      decideMutation.mutate({ id: request.id, decision: "approved" });
    }
  }

  function handleConfirmApprove() {
    setPhase("idle");
    setStaleSnapshot(null);
    decideMutation.mutate({ id: request.id, decision: "approved" });
  }

  function handleDeny() {
    setPhase("idle");
    setStaleSnapshot(null);
    decideMutation.mutate({ id: request.id, decision: "denied" });
  }

  const disabled = phase === "revalidating" || decideMutation.isPending;

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-900">
          {getEmployeeName(request.employeeId)} — {request.days} días — {getLocationName(request.locationId)}
        </p>
        <p className="text-xs text-gray-500">
          {request.startDate} → {request.endDate}
        </p>
      </div>

      <BalanceContext
        balance={balanceQuery.data?.balance}
        isStale={balanceQuery.isStale}
        isRevalidating={phase === "revalidating"}
        staleSnapshot={phase === "stale-confirm" ? staleSnapshot : null}
      />

      <ApproveDenyButtons
        phase={phase}
        disabled={disabled}
        onApprove={handleApproveClick}
        onConfirmApprove={handleConfirmApprove}
        onDeny={handleDeny}
      />

      {decideMutation.isError && (
        <p className="text-sm text-red-600">No se pudo registrar la decisión. Intenta de nuevo.</p>
      )}
    </div>
  );
}
