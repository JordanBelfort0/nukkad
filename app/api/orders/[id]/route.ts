import { requireRole } from "@/lib/auth/session";
import { acceptOrder } from "@/lib/services/orders";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("user", "manager", "delivery");
    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) throw new HttpError(404, "Order not found");
    return Response.json(order);
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("manager");
    const { id } = await params;
    const order = await acceptOrder(s.userId, id);
    return Response.json(order);
  } catch (e) { return errorResponse(e); }
}
