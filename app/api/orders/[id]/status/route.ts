import { requireRole } from "@/lib/auth/session";
import { advanceOrderStatus } from "@/lib/services/orders";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("delivery");
    const { id } = await params;
    const { to } = await req.json() as { to: "picked_up" | "delivered" };
    const order = await advanceOrderStatus(s.userId, id, to);
    return Response.json(order);
  } catch (e) { return errorResponse(e); }
}
