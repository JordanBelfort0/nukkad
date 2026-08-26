import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createReview } from "@/lib/services/reviews";

beforeEach(resetDb);

async function seedManagerAndBusiness() {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1, rating: 0 }).returning();
  return { m, b };
}

test("review recomputes business average rating", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [u1] = await db.insert(users).values({ name: "U1", email: "u1@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [u2] = await db.insert(users).values({ name: "U2", email: "u2@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1, rating: 0 }).returning();

  // Seed delivered orders so createReview auth passes
  await db.insert(orders).values({ userId: u1.id, businessId: b.id, deliveryAddress: "a", deliveryLat: 1, deliveryLng: 1, totalAmount: 10, status: "delivered" });
  await db.insert(orders).values({ userId: u2.id, businessId: b.id, deliveryAddress: "a", deliveryLat: 1, deliveryLng: 1, totalAmount: 10, status: "delivered" });

  await createReview(u1.id, { businessId: b.id, rating: 4 });
  await createReview(u2.id, { businessId: b.id, rating: 2 });
  const [after] = await db.select().from(businesses).where(eq(businesses.id, b.id));
  expect(after.rating).toBe(3);
});

test("createReview throws 403 if user has no delivered order from the business", async () => {
  const { b } = await seedManagerAndBusiness();
  const [u] = await db.insert(users).values({ name: "U", email: "u@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();

  await expect(createReview(u.id, { businessId: b.id, rating: 5 }))
    .rejects.toMatchObject({ status: 403 });
});

test("createReview succeeds and updates rating when user has a delivered order", async () => {
  const { b } = await seedManagerAndBusiness();
  const [u] = await db.insert(users).values({ name: "U", email: "u@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();

  await db.insert(orders).values({
    userId: u.id,
    businessId: b.id,
    deliveryAddress: "123 St",
    deliveryLat: 1,
    deliveryLng: 1,
    totalAmount: 50,
    status: "delivered",
  });

  const review = await createReview(u.id, { businessId: b.id, rating: 5, comment: "Great!" });
  expect(review.rating).toBe(5);
  expect(review.userId).toBe(u.id);

  const [after] = await db.select().from(businesses).where(eq(businesses.id, b.id));
  expect(after.rating).toBe(5);
});
