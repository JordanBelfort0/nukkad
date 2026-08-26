import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createReview } from "@/lib/services/reviews";

beforeEach(resetDb);

test("review recomputes business average rating", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [u1] = await db.insert(users).values({ name: "U1", email: "u1@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [u2] = await db.insert(users).values({ name: "U2", email: "u2@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1, rating: 0 }).returning();

  await createReview(u1.id, { businessId: b.id, rating: 4 });
  await createReview(u2.id, { businessId: b.id, rating: 2 });
  const [after] = await db.select().from(businesses).where(eq(businesses.id, b.id));
  expect(after.rating).toBe(3);
});
