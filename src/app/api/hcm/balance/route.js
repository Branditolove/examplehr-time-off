import { getBalance, setBalanceAdmin } from "@/lib/hcm/store";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const locationId = searchParams.get("locationId");
  if (!employeeId || !locationId) {
    return Response.json({ error: "employeeId and locationId are required" }, { status: 400 });
  }

  const balance = await getBalance(employeeId, locationId);
  if (!balance) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(balance);
}

export async function POST(request) {
  const body = await request.json();
  const { employeeId, locationId, balance, force } = body;
  if (!employeeId || !locationId || typeof balance !== "number") {
    return Response.json({ error: "employeeId, locationId and numeric balance are required" }, { status: 400 });
  }

  const result = await setBalanceAdmin({ employeeId, locationId, balance, force });
  if (result.error) return Response.json({ error: result.error }, { status: 404 });
  return Response.json(result.reported);
}
