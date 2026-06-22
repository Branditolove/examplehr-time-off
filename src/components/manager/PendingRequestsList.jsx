"use client";

import { usePendingRequests } from "@/hooks/usePendingRequests";
import { RequestRow } from "./RequestRow";

export function PendingRequestsList() {
  const query = usePendingRequests();

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Solicitudes pendientes</h2>
      {query.isPending && <p className="text-sm text-gray-400">Cargando…</p>}
      {query.data?.length === 0 && <p className="text-sm text-gray-400">No hay solicitudes pendientes</p>}
      {query.data?.map((request) => (
        <RequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}
