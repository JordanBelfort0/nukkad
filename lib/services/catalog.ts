import { db } from "@/lib/db/client";
import { businesses, offerings } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { eq, and, sql } from "drizzle-orm";

export type Business = typeof businesses.$inferSelect;
export type Offering = typeof offerings.$inferSelect;
export type BusinessInput = Omit<typeof businesses.$inferInsert, "id" | "managerId" | "rating" | "isActive" | "createdAt">;
export type OfferingInput = Omit<typeof offerings.$inferInsert, "id" | "isAvailable">;

export async function createBusiness(managerId: string, input: BusinessInput): Promise<Business> {
  const [b] = await db.insert(businesses).values({ ...input, managerId }).returning();
  return b;
}

export async function getBusinessWithOfferings(id: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!b) return null;
  const items = await db.select().from(offerings).where(eq(offerings.businessId, id));
  return { business: b, offerings: items };
}

async function assertOwns(managerId: string, businessId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) throw new HttpError(404, "Business not found");
  if (b.managerId !== managerId) throw new HttpError(403, "Not your business");
}

export async function createOffering(managerId: string, input: OfferingInput): Promise<Offering> {
  await assertOwns(managerId, input.businessId);
  if (input.type === "product" && input.stock == null) throw new HttpError(400, "stock required for product");
  if (input.type === "service" && input.durationMinutes == null) throw new HttpError(400, "durationMinutes required for service");
  const [o] = await db.insert(offerings).values(input).returning();
  return o;
}

export async function updateOffering(managerId: string, offeringId: string, patch: Partial<OfferingInput>): Promise<Offering> {
  const [o] = await db.select().from(offerings).where(eq(offerings.id, offeringId));
  if (!o) throw new HttpError(404, "Offering not found");
  await assertOwns(managerId, o.businessId);
  const [updated] = await db.update(offerings).set(patch).where(eq(offerings.id, offeringId)).returning();
  return updated;
}

export async function deleteOffering(managerId: string, offeringId: string): Promise<void> {
  const [o] = await db.select().from(offerings).where(eq(offerings.id, offeringId));
  if (!o) throw new HttpError(404, "Offering not found");
  await assertOwns(managerId, o.businessId);
  await db.delete(offerings).where(eq(offerings.id, offeringId));
}

export async function decrementStock(offeringId: string, qty: number, executor: typeof db = db): Promise<void> {
  const res = await executor.update(offerings)
    .set({ stock: sql`${offerings.stock} - ${qty}` })
    .where(and(eq(offerings.id, offeringId), sql`${offerings.stock} >= ${qty}`))
    .returning();
  if (res.length === 0) throw new HttpError(409, "Insufficient stock");
}
