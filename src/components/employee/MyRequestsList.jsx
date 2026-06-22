"use client";

import { useEmployeeRequests } from "@/hooks/useEmployeeRequests";
import { getLocationName } from "@/lib/hcm/lookup";
import { card, badge } from "@/lib/ui";

const statusTone = { pending: "info", approved: "success", denied: "danger" };
const statusText = { pending: "Pendiente", approved: "Aprobada", denied: "Denegada" };

export function MyRequestsList({ employeeId }) {
  const query = useEmployeeRequests(employeeId);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Mis solicitudes</h2>
      {query.isPending && <p className="text-sm text-gray-400">Cargando…</p>}
      {query.data?.length === 0 && <p className="text-sm text-gray-400">Todavía no has hecho solicitudes</p>}
      {query.data?.map((request) => (
        <div key={request.id} className={`${card} flex items-center justify-between gap-3`}>
          <div>
            <p className="font-medium text-gray-900">
              {getLocationName(request.locationId)} — {request.days} días
            </p>
            <p className="text-xs text-gray-500">
              {request.startDate} → {request.endDate}
            </p>
          </div>
          <span className={badge(statusTone[request.status] ?? "info")}>
            {statusText[request.status] ?? request.status}
          </span>
        </div>
      ))}
    </div>
  );
}
