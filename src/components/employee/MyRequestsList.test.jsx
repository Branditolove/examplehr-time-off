import { test, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MyRequestsList } from "./MyRequestsList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("renders each request with its status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requests: [
          { id: "req-1", locationId: "loc-mx", days: 2, startDate: "2026-07-01", endDate: "2026-07-02", status: "pending" },
          { id: "req-2", locationId: "loc-co", days: 5, startDate: "2026-06-01", endDate: "2026-06-05", status: "denied" },
        ],
      }),
    })
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MyRequestsList employeeId="emp-1" />
    </QueryClientProvider>
  );

  await waitFor(() => expect(screen.getByText("Pendiente")).toBeInTheDocument());
  expect(screen.getByText("Denegada")).toBeInTheDocument();
});

test("shows an empty state when there are no requests yet", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ requests: [] }) })
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MyRequestsList employeeId="emp-1" />
    </QueryClientProvider>
  );

  await waitFor(() =>
    expect(screen.getByText("Todavía no has hecho solicitudes")).toBeInTheDocument()
  );
});
