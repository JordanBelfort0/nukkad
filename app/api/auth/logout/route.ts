import { expiredSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
}
