import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, deliveryProfiles } from "@/lib/db/schema";
import { findNearestPartner } from "@/lib/services/assignment";

beforeEach(resetDb);

async function partner(name: string, lat: number, lng: number, available: boolean, city = "Jaipur") {
  const [u] = await db.insert(users).values({ name, email: `${name}@e.com`, passwordHash: "x", role: "delivery", city }).returning();
  await db.insert(deliveryProfiles).values({ userId: u.id, vehicleType: "bike", isAvailable: available, currentLat: lat, currentLng: lng });
  return u;
}

test("picks nearest available partner in the city", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 26.91, lng: 75.78, rating: 0 }).returning();

  const near = await partner("near", 26.92, 75.78, true);
  await partner("far", 27.5, 75.78, true);
  await partner("busy", 26.91, 75.78, false); // closest but unavailable

  expect(await findNearestPartner(b.id)).toBe(near.id);
});

test("returns null when nobody available", async () => {
  const [m] = await db.insert(users).values({ name: "M2", email: "m2@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 26.91, lng: 75.78, rating: 0 }).returning();
  await partner("busy", 26.91, 75.78, false);
  expect(await findNearestPartner(b.id)).toBeNull();
});
