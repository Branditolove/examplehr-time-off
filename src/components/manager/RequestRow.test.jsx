import { test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestRow } from "./RequestRow";

const request = {
  id: "req-1",
  employeeId: "emp-2",
  locationId: "loc-mx",
  days: 2,
  startDate: "2026-07-10",
  endDate: "2026-07-11",
};

function renderRow() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RequestRow request={request} />
    </QueryClientProvider>
  );
}

function mockFetchSequence({ balances, decisionOk = true }) {
  let balanceCall = 0;
  const fetchMock = vi.fn((url, options) => {
    if (options?.method === "PATCH") {
      return Promise.resolve({
        ok: decisionOk,
        status: decisionOk ? 200 : 409,
        json: async () => ({
          request: { ...request, status: JSON.parse(options.body).decision },
          balance: { employeeId: request.employeeId, locationId: request.locationId, balance: 4 },
        }),
      });
    }
    const balance = balances[Math.min(balanceCall, balances.length - 1)];
    balanceCall += 1;
    return Promise.resolve({
      ok: true,
      json: async () => ({ employeeId: request.employeeId, locationId: request.locationId, balance }),
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("approving with an unchanged balance decides directly, no confirmation step", async () => {
  const fetchMock = mockFetchSequence({ balances: [6, 6] });
  renderRow();

  await waitFor(() => expect(screen.getByText("6", { selector: "span" })).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));

  await waitFor(() => {
    const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH");
    expect(patchCall).toBeDefined();
  });
  expect(screen.queryByRole("button", { name: "Confirmar aprobación" })).not.toBeInTheDocument();
});

test("approving with a changed balance requires an explicit second confirmation", async () => {
  const fetchMock = mockFetchSequence({ balances: [6, 10] });
  renderRow();

  await waitFor(() => expect(screen.getByText("6", { selector: "span" })).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));

  await waitFor(() =>
    expect(screen.getByText(/El balance cambió de 6 a 10 días/)).toBeInTheDocument()
  );
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);

  await userEvent.click(screen.getByRole("button", { name: "Confirmar aprobación" }));

  await waitFor(() => {
    const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body)).toEqual({ decision: "approved" });
  });
});

test("denying does not trigger a balance revalidation", async () => {
  const fetchMock = mockFetchSequence({ balances: [6] });
  renderRow();

  await waitFor(() => expect(screen.getByText("6", { selector: "span" })).toBeInTheDocument());
  const balanceCallsBeforeDeny = fetchMock.mock.calls.filter(([, o]) => !o?.method || o.method === "GET").length;

  await userEvent.click(screen.getByRole("button", { name: "Denegar" }));

  await waitFor(() => {
    const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body)).toEqual({ decision: "denied" });
  });

  const balanceCallsAfterDeny = fetchMock.mock.calls.filter(([, o]) => !o?.method || o.method === "GET").length;
  expect(balanceCallsAfterDeny).toBe(balanceCallsBeforeDeny);
});
