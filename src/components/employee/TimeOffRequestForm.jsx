"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LOCATIONS } from "@/lib/hcm/locations";
import { queryKeys } from "@/lib/queryKeys";
import { card, input, label, button } from "@/lib/ui";
import { useTimeOffFormStore } from "@/store/timeOffFormStore";
import { useBalanceIntegrityStore } from "@/store/balanceIntegrityStore";
import { useSubmitTimeOffRequest } from "@/hooks/useSubmitTimeOffRequest";
import { RequestFeedback } from "./RequestFeedback";

const VERIFY_DELAY_MS = 4000;

export function TimeOffRequestForm({ employeeId }) {
  const { locationId, days, startDate, endDate, setField, reset } = useTimeOffFormStore();
  const mutation = useSubmitTimeOffRequest();
  const queryClient = useQueryClient();

  // Post-submit verification (TRD §6.2): the HCM may report success with a
  // balance that doesn't actually match what got persisted. Re-check once,
  // after giving the HCM a moment to "settle".
  useEffect(() => {
    if (!mutation.isSuccess || !mutation.data || !mutation.variables) return;

    const { employeeId: empId, locationId: locId } = mutation.variables;
    const key = `${empId}:${locId}`;
    const expected = mutation.data.balance.balance;
    useBalanceIntegrityStore.getState().setExpected(key, expected);

    const timeout = setTimeout(async () => {
      const queryKey = queryKeys.balance(empId, locId);
      await queryClient.refetchQueries({ queryKey, exact: true });
      const actual = queryClient.getQueryData(queryKey)?.balance;
      useBalanceIntegrityStore.getState().confirm(key, actual);
    }, VERIFY_DELAY_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isSuccess, mutation.data]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!locationId || !days || !startDate || !endDate) return;
    // Send the asOf the user last saw for this balance so the HCM can detect
    // a conflict if it changed underneath them before this request landed.
    const asOf = queryClient.getQueryData(queryKeys.balance(employeeId, locationId))?.asOf;
    mutation.mutate(
      { employeeId, locationId, days: Number(days), startDate, endDate, asOf },
      { onSuccess: () => reset() }
    );
  }

  const errorKind = mutation.isError ? mutation.error?.body?.error : null;

  let feedbackStatus = null;
  if (mutation.isPending) feedbackStatus = "pending";
  else if (errorKind === "insufficient_balance") feedbackStatus = "insufficient-balance";
  else if (errorKind === "conflict") feedbackStatus = "conflict";
  else if (mutation.isError) feedbackStatus = "error";
  else if (mutation.isSuccess) feedbackStatus = "success";

  return (
    <form onSubmit={handleSubmit} className={`${card} flex max-w-sm flex-col gap-4`}>
      <h2 className="font-semibold text-gray-900">Solicitar time-off</h2>

      <label className="flex flex-col gap-1">
        <span className={label}>Ubicación</span>
        <select
          value={locationId ?? ""}
          onChange={(event) => setField("locationId", event.target.value || null)}
          className={input}
        >
          <option value="">Selecciona una ubicación</option>
          {LOCATIONS.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={label}>Días solicitados</span>
        <input
          type="number"
          min="1"
          value={days || ""}
          onChange={(event) => setField("days", event.target.value)}
          className={input}
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className={label}>Desde</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setField("startDate", event.target.value)}
            className={input}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={label}>Hasta</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setField("endDate", event.target.value)}
            className={input}
          />
        </label>
      </div>

      <button type="submit" disabled={mutation.isPending} className={button("primary")}>
        {mutation.isPending ? "Enviando…" : "Solicitar"}
      </button>

      <RequestFeedback status={feedbackStatus} />
    </form>
  );
}
