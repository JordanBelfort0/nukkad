import { db } from "@/lib/db/client";
import { users, deliveryProfiles } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { signSession, buildSessionCookie } from "@/lib/auth/session";
import { signupSchema } from "@/lib/validation/schemas";
import { HttpError, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const data = signupSchema.parse(await req.json());
    const existing = await db.select().from(users).where(eq(users.email, data.email));
    if (existing.length) throw new HttpError(409, "Email already registered");
    if (data.role === "delivery" && !data.vehicleType) throw new HttpError(400, "vehicleType required for delivery");

    const [u] = await db.insert(users).values({
      name: data.name, email: data.email, phone: data.phone,
      passwordHash: await hashPassword(data.password), role: data.role, city: data.city,
    }).returning();

    if (data.role === "delivery") {
      await db.insert(deliveryProfiles).values({ userId: u.id, vehicleType: data.vehicleType! });
    }

    const token = await signSession({ userId: u.id, role: u.role });
    return Response.json({ id: u.id, role: u.role }, {
      status: 201,
      headers: { "Set-Cookie": buildSessionCookie(token) },
    });
  } catch (e) { return errorResponse(e); }
}
