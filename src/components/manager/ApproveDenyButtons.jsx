import { button } from "@/lib/ui";

export function ApproveDenyButtons({ phase, disabled, onApprove, onConfirmApprove, onDeny }) {
  return (
    <div className="flex gap-2">
      {phase === "stale-confirm" ? (
        <button type="button" onClick={onConfirmApprove} disabled={disabled} className={button("warning")}>
          Confirmar aprobación
        </button>
      ) : (
        <button type="button" onClick={onApprove} disabled={disabled} className={button("success")}>
          {phase === "revalidating" ? "Revalidando…" : "Aprobar"}
        </button>
      )}
      <button type="button" onClick={onDeny} disabled={disabled} className={button("outline")}>
        Denegar
      </button>
    </div>
  );
}
