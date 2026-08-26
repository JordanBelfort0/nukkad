import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { deliveryProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
import { availabilitySchema } from "@/lib/validation/schemas";
export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    const s = await requireRole("delivery");
    const body = availabilitySchema.parse(await req.json());
    const [updated] = await db.update(deliveryProfiles)
      .set({ isAvailable: body.isAvailable, currentLat: body.lat, currentLng: body.lng })
      .where(eq(deliveryProfiles.userId, s.userId))
      .returning();
    return Response.json(updated);
  } catch (e) { return errorResponse(e); }
}
