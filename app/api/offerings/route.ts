import { requireRole } from "@/lib/auth/session";
import { offeringSchema } from "@/lib/validation/schemas";
import { createOffering } from "@/lib/services/catalog";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("manager");
    const data = offeringSchema.parse(await req.json());
    const o = await createOffering(s.userId, data);
    return Response.json(o, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
