import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useTimeOffFormStore } from "@/store/timeOffFormStore";
import { useBalanceIntegrityStore } from "@/store/balanceIntegrityStore";
import { useBalance } from "@/hooks/useBalance";
import { TimeOffRequestForm } from "./TimeOffRequestForm";

function renderForm() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <TimeOffRequestForm employeeId="emp-1" />
    </QueryClientProvider>
  );
  return queryClient;
}

// Mirrors how EmployeePage actually composes things: a balance reader
// mounted alongside the form, sharing one QueryClient. Needed so the
// post-submit verification's refetchQueries has a real queryFn registered
// for the key, instead of a cache entry written only via setQueryData.
function HarnessWithBalanceReader({ employeeId, locationId }) {
  useBalance(employeeId, locationId);
  return <TimeOffRequestForm employeeId={employeeId} />;
}

async function fillForm() {
  await userEvent.selectOptions(screen.getByRole("combobox"), "loc-mx");
  await userEvent.type(screen.getByRole("spinbutton"), "3");
  // Date inputs aren't reliably queryable by role across environments; set directly.
  const [startInput, endInput] = document.querySelectorAll('input[type="date"]');
  await userEvent.type(startInput, "2026-07-01");
  await userEvent.type(endInput, "2026-07-03");
}

beforeEach(() => {
  useTimeOffFormStore.getState().reset();
  useBalanceIntegrityStore.setState({ entries: {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("submitting a valid request shows success feedback and resets the form", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        request: { id: "req-1", status: "pending" },
        balance: { employeeId: "emp-1", locationId: "loc-mx", balance: 9 },
      }),
    })
  );

  renderForm();
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: /Solicitar/ }));

  await waitFor(() => expect(screen.getByText(/pendiente de aprobación/)).toBeInTheDocument());
  expect(screen.getByRole("combobox")).toHaveValue("");
});

test("an HCM rejection (insufficient balance) shows the rejection feedback", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "insufficient_balance", balance: { balance: 2 } }),
    })
  );
  renderForm();
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: /Solicitar/ }));

  await waitFor(() =>
    expect(screen.getByText(/HCM rechazó la solicitud: balance insuficiente/)).toBeInTheDocument()
  );
});

test("an HCM conflict (stale asOf) shows distinct feedback from insufficient balance", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "conflict", balance: { balance: 13 } }),
    })
  );
  renderForm();
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: /Solicitar/ }));

  await waitFor(() =>
    expect(
      screen.getByText(/El balance cambió en el HCM antes de que tu solicitud llegara/)
    ).toBeInTheDocument()
  );
});

test("post-submit verification flags the balance as suspect when the HCM silently failed", async () => {
  const queryClient = new QueryClient();
  const balanceKey = queryKeys.balance("emp-1", "loc-mx");
  // Pre-seed fresh data so mounting useBalance doesn't itself consume a fetch call.
  queryClient.setQueryData(balanceKey, { employeeId: "emp-1", locationId: "loc-mx", balance: 12 });

  // Discriminate by HTTP method rather than call order: a background refetch
  // (e.g. the 60s polling interval) can legitimately add an extra GET call,
  // and the assertions below should hold regardless of exactly how many.
  const fetchMock = vi.fn((url, options) => {
    return Promise.resolve(
      options?.method === "POST"
        ? {
            ok: true,
            json: async () => ({
              request: { id: "req-1", status: "pending" },
              balance: { employeeId: "emp-1", locationId: "loc-mx", balance: 9 },
            }),
          }
        : {
            ok: true,
            json: async () => ({ employeeId: "emp-1", locationId: "loc-mx", balance: 12 }),
          }
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <QueryClientProvider client={queryClient}>
      <HarnessWithBalanceReader employeeId="emp-1" locationId="loc-mx" />
    </QueryClientProvider>
  );

  await fillForm();

  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: /Solicitar/ }));

  // Flush the submit mutation's promise chain without relying on RTL's
  // real-clock waitFor, which can't observe progress once timers are faked.
  await vi.advanceTimersByTimeAsync(0);
  expect(screen.getByText(/pendiente de aprobación/)).toBeInTheDocument();

  await vi.advanceTimersByTimeAsync(4000);

  expect(useBalanceIntegrityStore.getState().entries["emp-1:loc-mx"]?.suspect).toBe(true);
});
