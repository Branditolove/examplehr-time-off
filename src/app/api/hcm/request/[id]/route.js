import { decideRequest } from "@/lib/hcm/store";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { decision } = await request.json();

  const result = await decideRequest(id, decision);

  if (result.error === "not_found") return Response.json({ error: result.error }, { status: 404 });
  if (result.error === "already_decided") return Response.json({ error: result.error }, { status: 409 });
  if (result.error === "invalid_decision") return Response.json({ error: result.error }, { status: 400 });

  return Response.json(result);
}
