import { searchOfferings } from "@/lib/services/search";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const city = u.searchParams.get("city");
    const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
    if (!city || Number.isNaN(lat) || Number.isNaN(lng)) throw new HttpError(400, "city, lat, lng required");
    const type = u.searchParams.get("type") as "product" | "service" | null;
    const results = await searchOfferings({
      city, lat, lng, q: u.searchParams.get("q") ?? undefined,
      category: u.searchParams.get("category") ?? undefined, type: type ?? undefined,
    });
    return Response.json(results);
  } catch (e) { return errorResponse(e); }
}
