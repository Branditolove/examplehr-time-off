// Integration tests: call the real route handlers (real Request/Response,
// real store.js, real file-backed persistence) with nothing mocked. This is
// what guards the HTTP contract between the app and the mock HCM — unlike
// store.test.js (calls store functions directly, bypassing parsing/routing)
// or the component tests (mock fetch entirely).
import { describe, test, expect, beforeEach } from "vitest";
import { resetStore } from "@/lib/hcm/store";
import { GET as getBalance, POST as postBalance } from "./balance/route";
import { GET as getBatch } from "./balances/batch/route";
import { GET as getRequests, POST as postRequest } from "./request/route";
import { PATCH as patchRequest } from "./request/[id]/route";
import { POST as postAnniversary } from "./anniversary/route";

function jsonRequest(url, method, body) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  resetStore();
});

describe("submit -> approve flow", () => {
  test("submitting deducts the balance and lists the request as pending", async () => {
    const submitRes = await postRequest(
      jsonRequest("http://localhost/api/hcm/request", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        days: 3,
        startDate: "2026-07-01",
        endDate: "2026-07-03",
        force: "none",
      })
    );
    expect(submitRes.status).toBe(201);
    const submitBody = await submitRes.json();
    expect(submitBody.balance.balance).toBe(9);

    const balanceRes = await getBalance(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx")
    );
    expect((await balanceRes.json()).balance).toBe(9);

    const pendingRes = await getRequests(new Request("http://localhost/api/hcm/request?status=pending"));
    const pending = (await pendingRes.json()).requests;
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(submitBody.request.id);
  });

  test("approving removes the request from the pending list and keeps the deduction", async () => {
    const { request } = await (
      await postRequest(
        jsonRequest("http://localhost/api/hcm/request", "POST", {
          employeeId: "emp-2",
          locationId: "loc-mx",
          days: 2,
          startDate: "2026-07-10",
          endDate: "2026-07-11",
          force: "none",
        })
      )
    ).json();

    const approveRes = await patchRequest(
      jsonRequest(`http://localhost/api/hcm/request/${request.id}`, "PATCH", { decision: "approved" }),
      { params: Promise.resolve({ id: request.id }) }
    );
    expect(approveRes.status).toBe(200);
    expect((await approveRes.json()).request.status).toBe("approved");

    const pendingRes = await getRequests(new Request("http://localhost/api/hcm/request?status=pending"));
    expect((await pendingRes.json()).requests).toHaveLength(0);

    const balanceRes = await getBalance(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-2&locationId=loc-mx")
    );
    expect((await balanceRes.json()).balance).toBe(6);
  });

  test("denying restores the held balance", async () => {
    const { request } = await (
      await postRequest(
        jsonRequest("http://localhost/api/hcm/request", "POST", {
          employeeId: "emp-2",
          locationId: "loc-mx",
          days: 2,
          startDate: "2026-07-10",
          endDate: "2026-07-11",
          force: "none",
        })
      )
    ).json();

    await patchRequest(
      jsonRequest(`http://localhost/api/hcm/request/${request.id}`, "PATCH", { decision: "denied" }),
      { params: Promise.resolve({ id: request.id }) }
    );

    const balanceRes = await getBalance(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-2&locationId=loc-mx")
    );
    expect((await balanceRes.json()).balance).toBe(8);
  });

  test("deciding on an already-decided request is rejected with 409", async () => {
    const { request } = await (
      await postRequest(
        jsonRequest("http://localhost/api/hcm/request", "POST", {
          employeeId: "emp-1",
          locationId: "loc-mx",
          days: 1,
          startDate: "2026-07-01",
          endDate: "2026-07-01",
          force: "none",
        })
      )
    ).json();

    await patchRequest(
      jsonRequest(`http://localhost/api/hcm/request/${request.id}`, "PATCH", { decision: "approved" }),
      { params: Promise.resolve({ id: request.id }) }
    );
    const secondRes = await patchRequest(
      jsonRequest(`http://localhost/api/hcm/request/${request.id}`, "PATCH", { decision: "denied" }),
      { params: Promise.resolve({ id: request.id }) }
    );
    expect(secondRes.status).toBe(409);
    expect((await secondRes.json()).error).toBe("already_decided");
  });
});

describe("rejections", () => {
  test("submitting more days than the balance allows is rejected with 409 and leaves the balance untouched", async () => {
    const res = await postRequest(
      jsonRequest("http://localhost/api/hcm/request", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        days: 999,
        startDate: "2026-07-01",
        endDate: "2026-07-01",
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("insufficient_balance");

    const balanceRes = await getBalance(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx")
    );
    expect((await balanceRes.json()).balance).toBe(12);
  });

  test("force=insufficient always rejects regardless of actual balance", async () => {
    const res = await postRequest(
      jsonRequest("http://localhost/api/hcm/request", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        days: 1,
        force: "insufficient",
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("conflict responses", () => {
  test("submitting against a stale asOf is rejected with conflict, not insufficient_balance", async () => {
    const before = await (
      await getBalance(new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx"))
    ).json();

    await postAnniversary(
      jsonRequest("http://localhost/api/hcm/anniversary", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        bonusDays: 1,
      })
    );

    const res = await postRequest(
      jsonRequest("http://localhost/api/hcm/request", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        days: 2,
        asOf: before.asOf,
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("conflict");
    expect(body.balance.balance).toBe(13);
  });
});

describe("silent failures (TRD §6)", () => {
  test("force=silent-failure reports a deduction that never actually persisted", async () => {
    const submitRes = await postRequest(
      jsonRequest("http://localhost/api/hcm/request", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        days: 3,
        startDate: "2026-07-01",
        endDate: "2026-07-03",
        force: "silent-failure",
      })
    );
    const body = await submitRes.json();
    expect(body.balance.balance).toBe(9); // what the HCM claims

    const balanceRes = await getBalance(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx")
    );
    expect((await balanceRes.json()).balance).toBe(12); // what's actually persisted
  });

  test("force=silent-failure on the admin balance write also reports without persisting", async () => {
    const writeRes = await postBalance(
      jsonRequest("http://localhost/api/hcm/balance", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        balance: 99,
        force: "silent-failure",
      })
    );
    expect((await writeRes.json()).balance).toBe(99);

    const balanceRes = await getBalance(
      new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx")
    );
    expect((await balanceRes.json()).balance).toBe(12);
  });
});

describe("anniversary bonus mid-session (TRD §5)", () => {
  test("posting a bonus increases the balance independent of any pending request", async () => {
    const before = await (
      await getBalance(new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx"))
    ).json();
    expect(before.balance).toBe(12);

    const bonusRes = await postAnniversary(
      jsonRequest("http://localhost/api/hcm/anniversary", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        bonusDays: 5,
      })
    );
    expect((await bonusRes.json()).balance).toBe(17);

    const after = await (
      await getBalance(new Request("http://localhost/api/hcm/balance?employeeId=emp-1&locationId=loc-mx"))
    ).json();
    expect(after.balance).toBe(17);
  });
});

describe("batch endpoint", () => {
  test("returns every seeded balance row, reflecting prior mutations", async () => {
    await postRequest(
      jsonRequest("http://localhost/api/hcm/request", "POST", {
        employeeId: "emp-1",
        locationId: "loc-mx",
        days: 2,
        force: "none",
      })
    );

    const batchRes = await getBatch(new Request("http://localhost/api/hcm/balances/batch"));
    const { balances } = await batchRes.json();
    expect(balances).toHaveLength(3);
    expect(balances.find((b) => b.employeeId === "emp-1" && b.locationId === "loc-mx").balance).toBe(10);
  });

  test("supports filtering by employeeId", async () => {
    const batchRes = await getBatch(new Request("http://localhost/api/hcm/balances/batch?employeeId=emp-1"));
    const { balances } = await batchRes.json();
    expect(balances).toHaveLength(2);
    expect(balances.every((b) => b.employeeId === "emp-1")).toBe(true);
  });
});
