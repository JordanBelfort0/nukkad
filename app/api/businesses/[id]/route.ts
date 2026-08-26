import { getBusinessWithOfferings } from "@/lib/services/catalog";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getBusinessWithOfferings(id);
    if (!data) throw new HttpError(404, "Not found");
    return Response.json(data);
  } catch (e) { return errorResponse(e); }
}
