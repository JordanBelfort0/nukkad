import { beforeEach, expect, test, vi } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, offerings, orders } from "@/lib/db/schema";

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

function jsonReq(body: unknown, method = "POST") {
  return new Request("http://t", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
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

test("GET /api/orders/[id] — user B cannot see user A's order (403), user A can (200)", async () => {
  // Seed manager, business, two users, an offering, and an order owned by userA
  const [manager] = await db.insert(users).values({ name: "Mgr", email: "mgr@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [userA] = await db.insert(users).values({ name: "A", email: "a@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [userB] = await db.insert(users).values({ name: "B", email: "b@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();

  const [biz] = await db.insert(businesses).values({ managerId: manager.id, name: "Biz", category: "food", city: "Jaipur", address: "Addr", lat: 26, lng: 75 }).returning();
  const [offering] = await db.insert(offerings).values({ businessId: biz.id, type: "product", name: "Item", price: 10, stock: 100 }).returning();
  const [order] = await db.insert(orders).values({
    userId: userA.id,
    businessId: biz.id,
    deliveryAddress: "123 St",
    deliveryLat: 26,
    deliveryLng: 75,
    totalAmount: 10,
  }).returning();

  const { GET } = await import("@/app/api/orders/[id]/route");
  const fakeParams = { params: Promise.resolve({ id: order.id }) };

  // User B should be forbidden
  current = { userId: userB.id, role: "user" };
  const forbidden = await GET(new Request("http://t"), fakeParams);
  expect(forbidden.status).toBe(403);

  // User A should be allowed
  current = { userId: userA.id, role: "user" };
  const ok = await GET(new Request("http://t"), fakeParams);
  expect(ok.status).toBe(200);
});

test("PATCH /api/delivery/availability — malformed body returns 400", async () => {
  const [dp] = await db.insert(users).values({ name: "D", email: "d@e.com", passwordHash: "x", role: "delivery", city: "Jaipur" }).returning();
  current = { userId: dp.id, role: "delivery" };

  const { PATCH } = await import("@/app/api/delivery/availability/route");
  // isAvailable should be boolean, not string — this should fail Zod validation
  const res = await PATCH(jsonReq({ isAvailable: "yes", lat: 26.9, lng: 75.8 }, "PATCH"));
  expect(res.status).toBe(400);
});
