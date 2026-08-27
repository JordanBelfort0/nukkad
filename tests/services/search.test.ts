import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, offerings } from "@/lib/db/schema";
import { searchOfferings } from "@/lib/services/search";

beforeEach(resetDb);

async function seedBiz(name: string, lat: number, lng: number, rating: number, city = "Jaipur") {
  const [m] = await db.insert(users).values({ name, email: `${name}@e.com`, passwordHash: "x", role: "manager", city }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name, category: "clothing", city, address: "a", lat, lng, rating }).returning();
  await db.insert(offerings).values({ businessId: b.id, type: "product", name: `${name} kurta`, price: 100, stock: 3 });
  return b;
}

test("ranks nearer + higher-rated first and filters by city", async () => {
  // user at (26.91, 75.78)
  await seedBiz("Near", 26.91, 75.78, 4.0);   // ~0km, score ≈ 4.0
  await seedBiz("Far", 27.5, 75.78, 5.0);      // ~65km, score ≈ 5.0 - 6.5 = -1.5
  await seedBiz("OtherCity", 26.91, 75.78, 5.0, "Delhi"); // excluded

  const results = await searchOfferings({ city: "Jaipur", lat: 26.91, lng: 75.78 });
  expect(results.map(r => r.business.name)).toEqual(["Near", "Far"]);
  expect(results[0].distanceKm).toBeLessThan(1);
});

test("type filter works", async () => {
  await seedBiz("Near", 26.91, 75.78, 4.0);
  const products = await searchOfferings({ city: "Jaipur", lat: 26.91, lng: 75.78, type: "service" });
  expect(products).toHaveLength(0);
});

test("q matches across offering name, description, business name and category", async () => {
  const [m] = await db.insert(users).values({ name: "CM", email: "cm@e.com", passwordHash: "x", role: "manager", city: "Mumbai" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "Fashion Hub", category: "Clothing", city: "Mumbai", address: "a", lat: 19.07, lng: 72.87, rating: 0 }).returning();
  await db.insert(offerings).values({ businessId: b.id, type: "product", name: "saree1", description: "cotton fabric", price: 500, stock: 5 });
  const params = { city: "Mumbai", lat: 19.07, lng: 72.87 };
  expect((await searchOfferings({ ...params, q: "clothing" })).length).toBe(1); // category (substring)
  expect((await searchOfferings({ ...params, q: "clothes" })).length).toBe(1);  // category via stemming (clothes→cloth←clothing)
  expect((await searchOfferings({ ...params, q: "saree" })).length).toBe(1);    // name
  expect((await searchOfferings({ ...params, q: "cotton" })).length).toBe(1);   // description
  expect((await searchOfferings({ ...params, q: "fashion" })).length).toBe(1);  // business name
  expect((await searchOfferings({ ...params, q: "zzz-nomatch" })).length).toBe(0);
});

test("city match is case-insensitive and trimmed", async () => {
  await seedBiz("MumbaiShop", 19.07, 72.87, 4.0, "Mumbai"); // stored "Mumbai"
  // user types a different casing / stray spaces
  const lower = await searchOfferings({ city: "mumbai", lat: 19.07, lng: 72.87 });
  expect(lower.map((r) => r.business.name)).toContain("MumbaiShop");
  const spaced = await searchOfferings({ city: "  MUMBAI ", lat: 19.07, lng: 72.87 });
  expect(spaced.map((r) => r.business.name)).toContain("MumbaiShop");
});
