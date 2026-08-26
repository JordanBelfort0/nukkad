import { requireRole } from "@/lib/auth/session";
import { orderSchema } from "@/lib/validation/schemas";
import { createOrder } from "@/lib/services/orders";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("user");
    const data = orderSchema.parse(await req.json());
    const order = await createOrder(s.userId, data);
    return Response.json(order, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export async function GET(_: Request) {
  try {
    const s = await requireRole("user");
    const myOrders = await db.select().from(orders).where(eq(orders.userId, s.userId));
    return Response.json(myOrders);
  } catch (e) { return errorResponse(e); }
}
