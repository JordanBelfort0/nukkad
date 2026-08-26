import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, offerings, deliveryProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createOrder, acceptOrder, advanceOrderStatus } from "@/lib/services/orders";

beforeEach(resetDb);

async function seed() {
  const [mgr] = await db.insert(users).values({ name: "Mgr", email: "mgr@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [usr] = await db.insert(users).values({ name: "Usr", email: "usr@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [biz] = await db.insert(businesses).values({ managerId: mgr.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 26.91, lng: 75.78, rating: 0 }).returning();
  const [off] = await db.insert(offerings).values({ businessId: biz.id, type: "product", name: "P", price: 100, stock: 5 }).returning();
  const [par] = await db.insert(users).values({ name: "Par", email: "par@e.com", passwordHash: "x", role: "delivery", city: "Jaipur" }).returning();
  await db.insert(deliveryProfiles).values({ userId: par.id, vehicleType: "bike", isAvailable: true, currentLat: 26.91, currentLng: 75.78 });
  return { mgr, usr, biz, off, par };
}

test("create → accept auto-assigns and decrements stock", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 2 }], deliveryAddress: "home", deliveryLat: 26.91, deliveryLng: 75.78 });
  expect(order.status).toBe("pending");
  expect(order.totalAmount).toBe(200);

  const accepted = await acceptOrder(mgr.id, order.id);
  expect(accepted.status).toBe("assigned");
  expect(accepted.deliveryPartnerId).toBe(par.id);
  const [o] = await db.select().from(offerings).where(eq(offerings.id, off.id));
  expect(o.stock).toBe(3);
  const [p] = await db.select().from(deliveryProfiles).where(eq(deliveryProfiles.userId, par.id));
  expect(p.isAvailable).toBe(false);
});

test("no partner → stays accepted", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  await db.update(deliveryProfiles).set({ isAvailable: false }).where(eq(deliveryProfiles.userId, par.id));
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  const accepted = await acceptOrder(mgr.id, order.id);
  expect(accepted.status).toBe("accepted");
  expect(accepted.deliveryPartnerId).toBeNull();
});

test("delivery transitions and frees partner", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  await acceptOrder(mgr.id, order.id);
  const picked = await advanceOrderStatus(par.id, order.id, "picked_up");
  expect(picked.status).toBe("picked_up");
  const delivered = await advanceOrderStatus(par.id, order.id, "delivered");
  expect(delivered.status).toBe("delivered");
  const [p] = await db.select().from(deliveryProfiles).where(eq(deliveryProfiles.userId, par.id));
  expect(p.isAvailable).toBe(true);
});

test("cannot deliver before picked_up", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  await acceptOrder(mgr.id, order.id);
  await expect(advanceOrderStatus(par.id, order.id, "delivered")).rejects.toMatchObject({ status: 409 });
});

test("user cannot order from own business", async () => {
  const { mgr, biz, off } = await seed();
  await expect(createOrder(mgr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 1, deliveryLng: 1 })).rejects.toMatchObject({ status: 403 });
});

test("non-owning manager cannot accept order", async () => {
  const { usr, biz, off } = await seed();
  const [mgr2] = await db.insert(users).values({ name: "Mgr2", email: "mgr2@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  await expect(acceptOrder(mgr2.id, order.id)).rejects.toMatchObject({ status: 403 });
});

test("createOrder with service-type offering throws 400", async () => {
  const { usr, biz } = await seed();
  const [svc] = await db.insert(offerings).values({ businessId: biz.id, type: "service", name: "Haircut", price: 200, durationMinutes: 30 }).returning();
  await expect(createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: svc.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 })).rejects.toMatchObject({ status: 400 });
});

test("createOrder with duplicate offeringId line items succeeds", async () => {
  const { usr, biz, off } = await seed();
  // Same offeringId appears twice — deduped set has 1 entry, offs.length === uniqueIds.length — should not falsely 400
  const order = await createOrder(usr.id, {
    businessId: biz.id,
    items: [{ offeringId: off.id, quantity: 1 }, { offeringId: off.id, quantity: 2 }],
    deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78,
  });
  // Two line items, total = 3 * 100
  expect(order.totalAmount).toBe(300);
  expect(order.status).toBe("pending");
});
