const styles = {
  pending: "bg-gray-100 text-gray-600",
  "insufficient-balance": "bg-red-50 text-red-700",
  conflict: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
};

const text = {
  pending: "Solicitud en curso, tu balance ya se actualizó de forma provisional.",
  "insufficient-balance": "El HCM rechazó la solicitud: balance insuficiente. Tu balance se revirtió al valor real.",
  conflict: "El balance cambió en el HCM antes de que tu solicitud llegara. Revisa el balance actualizado e intenta de nuevo.",
  error: "No se pudo enviar la solicitud. Intenta de nuevo.",
  success: "Solicitud enviada, pendiente de aprobación.",
};

// status: "pending" | "insufficient-balance" | "conflict" | "error" | "success" | null
export function RequestFeedback({ status }) {
  if (!status) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${styles[status]}`}>{text[status]}</p>;
}
