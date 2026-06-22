import { describe, expect, test, beforeEach } from "vitest";
import {
  getBalance,
  submitRequest,
  decideRequest,
  applyAnniversaryBonus,
  resetStore,
} from "./store";

beforeEach(() => {
  resetStore();
});

describe("submitRequest", () => {
  test("rejects when days exceed balance", async () => {
    const result = await submitRequest({ employeeId: "emp-1", locationId: "loc-mx", days: 999 });
    expect(result.error).toBe("insufficient_balance");
  });

  test("deducts balance and creates a pending request on success", async () => {
    const result = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 3,
      force: "none",
    });
    expect(result.request.status).toBe("pending");
    expect(result.balance.balance).toBe(9);
    const stored = await getBalance("emp-1", "loc-mx");
    expect(stored.balance).toBe(9);
  });

  test("rejects with conflict when the submitted asOf no longer matches the stored balance", async () => {
    const current = await getBalance("emp-1", "loc-mx");
    await applyAnniversaryBonus({ employeeId: "emp-1", locationId: "loc-mx", bonusDays: 1 });
    const result = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 3,
      asOf: current.asOf,
    });
    expect(result.error).toBe("conflict");
    expect(result.balance.balance).toBe(13);
  });

  test("force=conflict always rejects with conflict regardless of asOf", async () => {
    const result = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 1,
      force: "conflict",
    });
    expect(result.error).toBe("conflict");
  });

  test("forced silent-failure reports success without persisting the deduction", async () => {
    const result = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 3,
      force: "silent-failure",
    });
    expect(result.balance.balance).toBe(9); // reported
    const stored = await getBalance("emp-1", "loc-mx");
    expect(stored.balance).toBe(12); // actually unchanged
  });
});

describe("decideRequest", () => {
  test("denying a request restores the held balance", async () => {
    const { request } = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 4,
      force: "none",
    });
    await decideRequest(request.id, "denied");
    const stored = await getBalance("emp-1", "loc-mx");
    expect(stored.balance).toBe(12);
  });

  test("approving a request leaves the held balance deducted", async () => {
    const { request } = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 4,
      force: "none",
    });
    await decideRequest(request.id, "approved");
    const stored = await getBalance("emp-1", "loc-mx");
    expect(stored.balance).toBe(8);
  });

  test("cannot decide on an already-decided request", async () => {
    const { request } = await submitRequest({
      employeeId: "emp-1",
      locationId: "loc-mx",
      days: 1,
      force: "none",
    });
    await decideRequest(request.id, "approved");
    const second = await decideRequest(request.id, "denied");
    expect(second.error).toBe("already_decided");
  });
});

describe("applyAnniversaryBonus", () => {
  test("adds bonus days to the current balance", async () => {
    const result = await applyAnniversaryBonus({ employeeId: "emp-1", locationId: "loc-mx", bonusDays: 5 });
    expect(result.balance.balance).toBe(17);
  });
});
