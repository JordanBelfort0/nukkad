import { requireRole } from "@/lib/auth/session";
import { updateOffering, deleteOffering } from "@/lib/services/catalog";
import { errorResponse } from "@/lib/http";
import { offeringPatchSchema } from "@/lib/validation/schemas";
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("manager");
    const { id } = await params;
    const patch = offeringPatchSchema.parse(await req.json());
    const o = await updateOffering(s.userId, id, patch);
    return Response.json(o);
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("manager");
    const { id } = await params;
    await deleteOffering(s.userId, id);
    return Response.json({ success: true });
  } catch (e) { return errorResponse(e); }
}
