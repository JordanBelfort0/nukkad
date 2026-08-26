import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, bookingRequests } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request) {
  try {
    const s = await requireRole("manager");
    const myBusinesses = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.managerId, s.userId));
    if (myBusinesses.length === 0) return Response.json([]);
    const businessIds = myBusinesses.map((b) => b.id);
    const bookings = await db.select().from(bookingRequests).where(inArray(bookingRequests.businessId, businessIds));
    return Response.json(bookings);
  } catch (e) { return errorResponse(e); }
}
