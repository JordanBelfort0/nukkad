import { getSession } from "@/lib/auth/session";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";

export async function GET() {
  try {
    const s = await getSession();
    if (!s) throw new HttpError(401, "Not authenticated");
    return Response.json({ userId: s.userId, role: s.role });
  } catch (e) {
    return errorResponse(e);
  }
}
