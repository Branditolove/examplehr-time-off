import { listRequests, submitRequest } from "@/lib/hcm/store";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const requests = await listRequests({ status, employeeId });
  return Response.json({ requests });
}

export async function POST(request) {
  const body = await request.json();
  const { employeeId, locationId, days, startDate, endDate, force, asOf } = body;
  if (!employeeId || !locationId || typeof days !== "number") {
    return Response.json(
      { error: "employeeId, locationId and numeric days are required" },
      { status: 400 }
    );
  }

  const result = await submitRequest({ employeeId, locationId, days, startDate, endDate, force, asOf });

  if (result.error === "not_found") return Response.json({ error: result.error }, { status: 404 });
  if (result.error === "invalid_days") return Response.json({ error: result.error }, { status: 400 });
  if (result.error === "insufficient_balance" || result.error === "conflict") {
    return Response.json({ error: result.error, balance: result.balance }, { status: 409 });
  }

  return Response.json(result, { status: 201 });
}
