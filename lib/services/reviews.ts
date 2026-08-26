import { db } from "@/lib/db/client";
import { reviews, businesses, orders } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { HttpError } from "@/lib/http";

export type Review = typeof reviews.$inferSelect;

export async function createReview(userId: string, input: { businessId: string; orderId?: string; rating: number; comment?: string }): Promise<Review> {
  // §5.5 — user must have at least one delivered order from this business
  const deliveredOrders = await db.select().from(orders).where(
    and(
      eq(orders.userId, userId),
      eq(orders.businessId, input.businessId),
      eq(orders.status, "delivered"),
    )
  );
  if (deliveredOrders.length === 0) {
    throw new HttpError(403, "You can only review a business you've received a delivered order from");
  }

  // If orderId provided, additionally verify it belongs to this user, this business, and is delivered
  if (input.orderId) {
    const specificOrder = deliveredOrders.find((o) => o.id === input.orderId);
    if (!specificOrder) {
      throw new HttpError(403, "You can only review a business you've received a delivered order from");
    }
  }

  const [r] = await db.insert(reviews).values({
    userId, businessId: input.businessId, orderId: input.orderId, rating: input.rating, comment: input.comment,
  }).returning();

  const [{ avg }] = await db.select({ avg: sql<number>`avg(${reviews.rating})` })
    .from(reviews).where(eq(reviews.businessId, input.businessId));
  await db.update(businesses).set({ rating: Number(avg) }).where(eq(businesses.id, input.businessId));
  return r;
}
