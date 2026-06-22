import { badge } from "@/lib/ui";

export function BalanceContext({ balance, isStale, isRevalidating, staleSnapshot }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-sm">
      {isRevalidating && <p className="text-gray-500">Revalidando balance con el HCM…</p>}
      {!isRevalidating && staleSnapshot && (
        <p className="text-amber-700">
          El balance cambió de {staleSnapshot.previous} a {staleSnapshot.current} días desde que se cargó la
          lista. Confirma para aprobar con el valor actual.
        </p>
      )}
      {!isRevalidating && !staleSnapshot && (
        <p className="flex items-center gap-2 text-gray-700">
          Balance actual: <span className="font-semibold text-gray-900">{balance}</span> días
          {isStale && <span className={badge("warning")}>Posiblemente desactualizado</span>}
        </p>
      )}
    </div>
  );
}
