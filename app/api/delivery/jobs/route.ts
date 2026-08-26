import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request) {
  try {
    const s = await requireRole("delivery");
    const jobs = await db.select().from(orders).where(
      and(
        eq(orders.deliveryPartnerId, s.userId),
        inArray(orders.status, ["assigned", "picked_up"])
      )
    );
    return Response.json(jobs);
  } catch (e) { return errorResponse(e); }
}
