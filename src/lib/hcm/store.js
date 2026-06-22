// ponytail: persisted to a local JSON file, not just module/globalThis state.
// Next.js dev (Turbopack) can run route handlers in isolated module graphs
// that don't reliably share a single in-memory JS object, so this mock HCM
// uses the filesystem as its one shared source of truth instead. Resets
// whenever the file is deleted; a real integration would call the real HCM.

import fs from "node:fs";
import path from "node:path";
import { EMPLOYEES } from "./employees";
import { LOCATIONS } from "./locations";

const SILENT_FAILURE_CHANCE = 0.15;
const STORE_PATH = path.join(process.cwd(), ".hcm-store.json");

function seed() {
  return {
    balances: [
      ["emp-1:loc-mx", row("emp-1", "loc-mx", 12)],
      ["emp-1:loc-co", row("emp-1", "loc-co", 5)],
      ["emp-2:loc-mx", row("emp-2", "loc-mx", 8)],
    ],
    requests: [],
    requestSeq: 0,
  };
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      balances: new Map(parsed.balances),
      requests: new Map(parsed.requests),
      requestSeq: parsed.requestSeq,
    };
  } catch {
    const fresh = seed();
    writeStore({ balances: new Map(fresh.balances), requests: new Map(fresh.requests), requestSeq: fresh.requestSeq });
    return readStore();
  }
}

function writeStore(store) {
  fs.writeFileSync(
    STORE_PATH,
    JSON.stringify({
      balances: [...store.balances.entries()],
      requests: [...store.requests.entries()],
      requestSeq: store.requestSeq,
    })
  );
}

function row(employeeId, locationId, balance) {
  return { employeeId, locationId, balance, asOf: new Date().toISOString() };
}

function key(employeeId, locationId) {
  return `${employeeId}:${locationId}`;
}

function maybe(chance) {
  return Math.random() < chance;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isKnownPair(employeeId, locationId) {
  return EMPLOYEES.some((e) => e.id === employeeId) && LOCATIONS.some((l) => l.id === locationId);
}

async function getBalance(employeeId, locationId) {
  await sleep(150);
  return readStore().balances.get(key(employeeId, locationId)) ?? null;
}

async function listBalances(employeeId) {
  await sleep(800); // ponytail: fixed delay stands in for "costoso"; tune if a perf scenario needs it
  const all = [...readStore().balances.values()];
  return employeeId ? all.filter((b) => b.employeeId === employeeId) : all;
}

// Generic admin write. Mirrors the "can fail silently" requirement: response always
// reports the requested value, but the persisted value sometimes doesn't match it.
async function setBalanceAdmin({ employeeId, locationId, balance, force }) {
  if (!isKnownPair(employeeId, locationId)) return { error: "not_found" };
  await sleep(200);
  const reported = row(employeeId, locationId, balance);
  const silentlyWrong = force === "silent-failure" || (!force && maybe(SILENT_FAILURE_CHANCE));
  if (!silentlyWrong) {
    const store = readStore();
    store.balances.set(key(employeeId, locationId), reported);
    writeStore(store);
  }
  // else: store left untouched on purpose — caller gets a "success" that lied.
  return { reported };
}

async function submitRequest({ employeeId, locationId, days, startDate, endDate, force, asOf }) {
  if (!isKnownPair(employeeId, locationId)) return { error: "not_found" };
  if (!(days > 0)) return { error: "invalid_days" };

  await sleep(400);
  const store = readStore();
  const current = store.balances.get(key(employeeId, locationId));
  if (!current) return { error: "not_found" };

  // Conflict: the client's view of the balance (asOf) is no longer the current
  // one — something else (an approval, an anniversary bonus) changed it between
  // the read the user saw and this submit.
  if (force === "conflict" || (asOf && asOf !== current.asOf)) {
    return { error: "conflict", balance: current };
  }

  if (force === "insufficient" || days > current.balance) {
    return { error: "insufficient_balance", balance: current };
  }

  const newBalance = current.balance - days;
  const silentlyWrong = force === "silent-failure" || (!force && maybe(SILENT_FAILURE_CHANCE));
  if (!silentlyWrong) {
    store.balances.set(key(employeeId, locationId), row(employeeId, locationId, newBalance));
  }
  // else: balance left at `current` in storage while we report `newBalance` below.

  store.requestSeq += 1;
  const request = {
    id: `req-${store.requestSeq}`,
    employeeId,
    locationId,
    days,
    startDate,
    endDate,
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  store.requests.set(request.id, request);
  writeStore(store);

  return { request, balance: row(employeeId, locationId, newBalance) };
}

async function listRequests({ status, employeeId } = {}) {
  await sleep(200);
  let all = [...readStore().requests.values()];
  if (status) all = all.filter((r) => r.status === status);
  if (employeeId) all = all.filter((r) => r.employeeId === employeeId);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function decideRequest(id, decision) {
  await sleep(300);
  const store = readStore();
  const request = store.requests.get(id);
  if (!request) return { error: "not_found" };
  if (request.status !== "pending") return { error: "already_decided" };
  if (decision !== "approved" && decision !== "denied") return { error: "invalid_decision" };

  if (decision === "denied") {
    const current = store.balances.get(key(request.employeeId, request.locationId));
    if (current) {
      store.balances.set(
        key(request.employeeId, request.locationId),
        row(request.employeeId, request.locationId, current.balance + request.days)
      );
    }
  }

  request.status = decision;
  request.decidedAt = new Date().toISOString();
  store.requests.set(request.id, request);
  writeStore(store);

  return { request, balance: store.balances.get(key(request.employeeId, request.locationId)) ?? null };
}

async function applyAnniversaryBonus({ employeeId, locationId, bonusDays = 2 }) {
  if (!isKnownPair(employeeId, locationId)) return { error: "not_found" };
  await sleep(100);
  const store = readStore();
  const current = store.balances.get(key(employeeId, locationId));
  if (!current) return { error: "not_found" };
  const updated = row(employeeId, locationId, current.balance + bonusDays);
  store.balances.set(key(employeeId, locationId), updated);
  writeStore(store);
  return { balance: updated };
}

// ponytail: module-level setInterval simulating the HCM's background anniversary
// job for local dev/demo. Single fixed pair, single process — wouldn't survive a
// serverless/multi-instance deploy; a real cron/scheduler would replace this.
const ANNIVERSARY_TIMER_MS = 45_000;
let anniversaryTimerStarted = false;
function startAnniversaryTimer() {
  if (anniversaryTimerStarted) return;
  anniversaryTimerStarted = true;
  setInterval(() => {
    applyAnniversaryBonus({ employeeId: "emp-1", locationId: "loc-mx", bonusDays: 1 }).catch(() => {});
  }, ANNIVERSARY_TIMER_MS);
}
if (process.env.NODE_ENV !== "test") startAnniversaryTimer();

function resetStore() {
  const fresh = seed();
  writeStore({ balances: new Map(fresh.balances), requests: new Map(fresh.requests), requestSeq: fresh.requestSeq });
}

export {
  EMPLOYEES,
  LOCATIONS,
  getBalance,
  listBalances,
  setBalanceAdmin,
  submitRequest,
  listRequests,
  decideRequest,
  applyAnniversaryBonus,
  resetStore,
};
