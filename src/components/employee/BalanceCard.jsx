import { card, badge, accentFor } from "@/lib/ui";

export function BalanceCard({
  locationName,
  status, // "loading" | "empty" | "ready"
  balance,
  isStale,
  justRefreshed,
  integritySuspect,
  expectedBalance,
  accentIndex = 0,
}) {
  const accent = accentFor(accentIndex);
  return (
    <div className={`${card} flex items-start justify-between gap-3`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accent.bar}`} aria-hidden="true" />
        <div>
          <p className="font-medium text-gray-900">{locationName}</p>
          {status === "loading" && (
            <p className="mt-1 animate-pulse text-sm text-gray-400">Cargando…</p>
          )}
          {status === "empty" && <p className="text-sm text-gray-400">Sin balance registrado</p>}
          {status === "ready" && (
            <p className="text-2xl font-semibold text-gray-900">
              {balance} <span className="text-sm font-normal text-gray-500">días</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {status === "ready" && isStale && (
          <span className={badge("warning")}>Posiblemente desactualizado</span>
        )}
        {justRefreshed && <span className={badge("info")}>Actualizado</span>}
        {integritySuspect && (
          <span className={badge("danger")}>
            Inconsistencia: HCM reportó {expectedBalance}, real {balance}
          </span>
        )}
      </div>
    </div>
  );
}
