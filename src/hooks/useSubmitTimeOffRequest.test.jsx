import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { HcmError } from "@/lib/hcm/client";

vi.mock("@/lib/hcm/client", async () => {
  const actual = await vi.importActual("@/lib/hcm/client");
  return { ...actual, submitTimeOffRequest: vi.fn() };
});

import { submitTimeOffRequest } from "@/lib/hcm/client";
import { useSubmitTimeOffRequest } from "./useSubmitTimeOffRequest";

function renderWithClient(queryClient) {
  return renderHook(() => useSubmitTimeOffRequest(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

const balanceKey = queryKeys.balance("emp-1", "loc-mx");

beforeEach(() => {
  vi.clearAllMocks();
});

test("applies an optimistic deduction immediately on submit", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(balanceKey, { employeeId: "emp-1", locationId: "loc-mx", balance: 10 });
  submitTimeOffRequest.mockImplementation(() => new Promise(() => {})); // never resolves

  const { result } = renderWithClient(queryClient);

  act(() => {
    result.current.mutate({ employeeId: "emp-1", locationId: "loc-mx", days: 3 });
  });

  await waitFor(() => {
    expect(queryClient.getQueryData(balanceKey).balance).toBe(7);
  });
});

test("rolls back to the pre-mutation balance when the HCM rejects", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(balanceKey, { employeeId: "emp-1", locationId: "loc-mx", balance: 10 });
  submitTimeOffRequest.mockRejectedValue(new HcmError("insufficient_balance", { status: 409 }));

  const { result } = renderWithClient(queryClient);

  act(() => {
    result.current.mutate({ employeeId: "emp-1", locationId: "loc-mx", days: 3 });
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(balanceKey).balance).toBe(10);
});

test("on success, replaces the optimistic value with the HCM-reported balance", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(balanceKey, { employeeId: "emp-1", locationId: "loc-mx", balance: 10 });
  submitTimeOffRequest.mockResolvedValue({
    request: { id: "req-1", status: "pending" },
    balance: { employeeId: "emp-1", locationId: "loc-mx", balance: 7 },
  });

  const { result } = renderWithClient(queryClient);

  act(() => {
    result.current.mutate({ employeeId: "emp-1", locationId: "loc-mx", days: 3 });
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(queryClient.getQueryData(balanceKey).balance).toBe(7);
});
