import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, offerings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request) {
  try {
    const s = await requireRole("manager");
    const [biz] = await db.select().from(businesses).where(eq(businesses.managerId, s.userId));
    if (!biz) return Response.json(null);
    const bizOfferings = await db.select().from(offerings).where(eq(offerings.businessId, biz.id));
    return Response.json({ business: biz, offerings: bizOfferings });
  } catch (e) { return errorResponse(e); }
}
