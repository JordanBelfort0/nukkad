import { db } from "@/lib/db/client";
import { reviews, businesses } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export type Review = typeof reviews.$inferSelect;

export async function createReview(userId: string, input: { businessId: string; orderId?: string; rating: number; comment?: string }): Promise<Review> {
  const [r] = await db.insert(reviews).values({
    userId, businessId: input.businessId, orderId: input.orderId, rating: input.rating, comment: input.comment,
  }).returning();

  const [{ avg }] = await db.select({ avg: sql<number>`avg(${reviews.rating})` })
    .from(reviews).where(eq(reviews.businessId, input.businessId));
  await db.update(businesses).set({ rating: Number(avg) }).where(eq(businesses.id, input.businessId));
  return r;
}
