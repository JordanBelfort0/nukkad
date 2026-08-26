import { requireRole } from "@/lib/auth/session";
import { reviewSchema } from "@/lib/validation/schemas";
import { createReview } from "@/lib/services/reviews";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("user");
    const data = reviewSchema.parse(await req.json());
    const review = await createReview(s.userId, data);
    return Response.json(review, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
