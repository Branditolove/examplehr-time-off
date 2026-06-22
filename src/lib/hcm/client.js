export class HcmError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new HcmError(data?.error ?? `Request failed: ${res.status}`, { status: res.status, body: data });
  }
  return data;
}

export function fetchBalance(employeeId, locationId) {
  return request(`/api/hcm/balance?employeeId=${employeeId}&locationId=${locationId}`);
}

export function fetchBalancesBatch(employeeId) {
  const qs = employeeId ? `?employeeId=${employeeId}` : "";
  return request(`/api/hcm/balances/batch${qs}`).then((data) => data.balances);
}

export function submitTimeOffRequest(payload) {
  return request("/api/hcm/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchPendingRequests() {
  return request("/api/hcm/request?status=pending").then((data) => data.requests);
}

export function fetchEmployeeRequests(employeeId) {
  return request(`/api/hcm/request?employeeId=${employeeId}`).then((data) => data.requests);
}

export function decideRequest(id, decision) {
  return request(`/api/hcm/request/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
}

export function triggerAnniversaryBonus(payload) {
  return request("/api/hcm/anniversary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
