import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders, businesses } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request) {
  try {
    const s = await requireRole("manager");
    const myBusinesses = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.managerId, s.userId));
    if (myBusinesses.length === 0) return Response.json([]);
    const businessIds = myBusinesses.map(b => b.id);
    const myOrders = await db.select().from(orders).where(inArray(orders.businessId, businessIds));
    return Response.json(myOrders);
  } catch (e) { return errorResponse(e); }
}
