import { requireRole } from "@/lib/auth/session";
import { businessSchema } from "@/lib/validation/schemas";
import { createBusiness } from "@/lib/services/catalog";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("manager");
    const data = businessSchema.parse(await req.json());
    const b = await createBusiness(s.userId, data);
    return Response.json(b, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
