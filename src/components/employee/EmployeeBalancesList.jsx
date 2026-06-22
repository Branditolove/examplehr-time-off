"use client";

import { LOCATIONS } from "@/lib/hcm/locations";
import { useEmployeeBalances } from "@/hooks/useEmployeeBalances";
import { EmployeeBalanceRow } from "./EmployeeBalanceRow";

export function EmployeeBalancesList({ employeeId }) {
  // Hydrates the per-location cache that each row reads via useBalance (TRD §4.3).
  useEmployeeBalances(employeeId);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Tus balances</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {LOCATIONS.map((location, index) => (
          <EmployeeBalanceRow key={location.id} employeeId={employeeId} location={location} accentIndex={index} />
        ))}
      </div>
    </div>
  );
}
