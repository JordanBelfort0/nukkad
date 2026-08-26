import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, buildSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { HttpError, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, password } = loginSchema.parse(await req.json());
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u || !(await verifyPassword(password, u.passwordHash))) throw new HttpError(401, "Invalid credentials");
    const token = await signSession({ userId: u.id, role: u.role });
    return Response.json({ id: u.id, role: u.role }, {
      headers: { "Set-Cookie": buildSessionCookie(token) },
    });
  } catch (e) { return errorResponse(e); }
}
