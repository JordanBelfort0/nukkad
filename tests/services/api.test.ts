import { beforeEach, expect, test, vi } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

// Mock the session so requireRole returns a chosen identity.
let current: { userId: string; role: "manager" | "user" | "delivery" } | null = null;
vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  getSession: async () => current,
  requireRole: async (...roles: string[]) => {
    if (!current) throw new (await import("@/lib/http")).HttpError(401, "no");
    if (!roles.includes(current.role)) throw new (await import("@/lib/http")).HttpError(403, "no");
    return current;
  },
  setSessionCookie: async () => {}, clearSessionCookie: async () => {},
}));

beforeEach(async () => { await resetDb(); current = null; });

function jsonReq(body: unknown) {
  return new Request("http://t", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

test("manager creates business via API, non-manager is forbidden", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const { POST } = await import("@/app/api/businesses/route");

  current = { userId: m.id, role: "user" };
  const forbidden = await POST(jsonReq({ name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 }));
  expect(forbidden.status).toBe(403);

  current = { userId: m.id, role: "manager" };
  const ok = await POST(jsonReq({ name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 }));
  expect(ok.status).toBe(201);
});
