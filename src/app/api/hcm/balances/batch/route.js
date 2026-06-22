import { listBalances } from "@/lib/hcm/store";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const balances = await listBalances(employeeId);
  return Response.json({ balances });
}
