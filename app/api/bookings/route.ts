import { requireRole } from "@/lib/auth/session";
import { bookingSchema } from "@/lib/validation/schemas";
import { createBooking } from "@/lib/services/bookings";
import { db } from "@/lib/db/client";
import { bookingRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("user");
    const data = bookingSchema.parse(await req.json());
    const booking = await createBooking(s.userId, data);
    return Response.json(booking, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export async function GET(_: Request) {
  try {
    const s = await requireRole("user");
    const myBookings = await db.select().from(bookingRequests).where(eq(bookingRequests.userId, s.userId));
    return Response.json(myBookings);
  } catch (e) { return errorResponse(e); }
}
