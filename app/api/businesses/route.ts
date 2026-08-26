import { requireRole } from "@/lib/auth/session";
import { businessSchema } from "@/lib/validation/schemas";
import { createBusiness } from "@/lib/services/catalog";
import { errorResponse, HttpError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("manager");
    const [existing] = await db.select().from(businesses).where(eq(businesses.managerId, s.userId));
    if (existing) throw new HttpError(409, "You already have a business");
    const data = businessSchema.parse(await req.json());
    const b = await createBusiness(s.userId, data);
    return Response.json(b, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
