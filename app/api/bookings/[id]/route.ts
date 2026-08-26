import { requireRole } from "@/lib/auth/session";
import { respondToBooking } from "@/lib/services/bookings";
import { errorResponse } from "@/lib/http";
import { bookingDecisionSchema } from "@/lib/validation/schemas";
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireRole("manager");
    const { id } = await params;
    const { decision } = bookingDecisionSchema.parse(await req.json());
    const booking = await respondToBooking(s.userId, id, decision);
    return Response.json(booking);
  } catch (e) { return errorResponse(e); }
}
