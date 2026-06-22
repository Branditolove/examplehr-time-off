import { applyAnniversaryBonus } from "@/lib/hcm/store";

// Manual trigger standing in for the HCM's work-anniversary job, per the spec
// ("timer o endpoint manual"). Call it while a session is open to see mid-session
// balance reconciliation.
export async function POST(request) {
  const { employeeId, locationId, bonusDays } = await request.json();
  if (!employeeId || !locationId) {
    return Response.json({ error: "employeeId and locationId are required" }, { status: 400 });
  }

  const result = await applyAnniversaryBonus({ employeeId, locationId, bonusDays });
  if (result.error) return Response.json({ error: result.error }, { status: 404 });
  return Response.json(result.balance);
}
