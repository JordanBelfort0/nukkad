import { requireRole } from "@/lib/auth/session";
import { acceptOrder } from "@/lib/services/orders";
import { db } from "@/lib/db/client";
import { orders, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("user", "manager", "delivery");
    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) throw new HttpError(404, "Order not found");
    if (s.role === "user") {
      if (order.userId !== s.userId) throw new HttpError(403, "Forbidden");
    } else if (s.role === "delivery") {
      if (order.deliveryPartnerId !== s.userId) throw new HttpError(403, "Forbidden");
    } else if (s.role === "manager") {
      const [business] = await db.select().from(businesses).where(eq(businesses.id, order.businessId));
      if (!business || business.managerId !== s.userId) throw new HttpError(403, "Forbidden");
    }
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
