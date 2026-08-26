import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createBusiness, createOffering, getBusinessWithOfferings, decrementStock } from "@/lib/services/catalog";

async function makeManager() {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  return m;
}
beforeEach(resetDb);

test("manager creates a business and a product offering", async () => {
  const m = await makeManager();
  const b = await createBusiness(m.id, { name: "Kurta Co", category: "clothing", city: "Jaipur", address: "MI Rd", lat: 26.91, lng: 75.78 });
  const o = await createOffering(m.id, { businessId: b.id, type: "product", name: "Red Kurta", price: 1200, stock: 5 });
  const full = await getBusinessWithOfferings(b.id);
  expect(full?.offerings).toHaveLength(1);
  expect(o.stock).toBe(5);
});

test("product without stock is rejected", async () => {
  const m = await makeManager();
  const b = await createBusiness(m.id, { name: "X", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 });
  await expect(createOffering(m.id, { businessId: b.id, type: "product", name: "No stock", price: 10 } as any)).rejects.toThrow();
});

test("decrementStock rejects when insufficient", async () => {
  const m = await makeManager();
  const b = await createBusiness(m.id, { name: "X", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 });
  const o = await createOffering(m.id, { businessId: b.id, type: "product", name: "P", price: 10, stock: 2 });
  await expect(decrementStock(o.id, 5)).rejects.toThrow();
});
