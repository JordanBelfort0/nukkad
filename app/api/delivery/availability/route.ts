import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { deliveryProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    const s = await requireRole("delivery");
    const { isAvailable, lat, lng } = await req.json() as { isAvailable: boolean; lat: number; lng: number };
    const [updated] = await db.update(deliveryProfiles)
      .set({ isAvailable, currentLat: lat, currentLng: lng })
      .where(eq(deliveryProfiles.userId, s.userId))
      .returning();
    return Response.json(updated);
  } catch (e) { return errorResponse(e); }
}
