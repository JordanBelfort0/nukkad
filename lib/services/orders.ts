import { db } from "@/lib/db/client";
import { orders, orderItems, offerings, businesses, deliveryProfiles } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { and, eq, inArray } from "drizzle-orm";
import { decrementStock } from "./catalog";
import { findNearestPartner } from "./assignment";

export type Order = typeof orders.$inferSelect;
export interface OrderInput {
  businessId: string;
  items: { offeringId: string; quantity: number }[];
  deliveryAddress: string; deliveryLat: number; deliveryLng: number;
}

export async function createOrder(userId: string, input: OrderInput): Promise<Order> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, input.businessId));
  if (!biz) throw new HttpError(404, "Business not found");
  if (biz.managerId === userId) throw new HttpError(403, "Cannot order from your own business");

  const ids = input.items.map(i => i.offeringId);
  const offs = await db.select().from(offerings).where(inArray(offerings.id, ids));
  if (offs.length !== ids.length) throw new HttpError(400, "Unknown offering");
  if (offs.some(o => o.businessId !== input.businessId)) throw new HttpError(400, "All items must be from one business");
  if (offs.some(o => o.type !== "product")) throw new HttpError(400, "Only products can be ordered");

  const priceById = new Map(offs.map(o => [o.id, o.price]));
  const total = input.items.reduce((sum, i) => sum + priceById.get(i.offeringId)! * i.quantity, 0);

  const [order] = await db.insert(orders).values({
    userId, businessId: input.businessId, status: "pending",
    deliveryAddress: input.deliveryAddress, deliveryLat: input.deliveryLat, deliveryLng: input.deliveryLng,
    totalAmount: total,
  }).returning();

  await db.insert(orderItems).values(input.items.map(i => ({
    orderId: order.id, offeringId: i.offeringId, quantity: i.quantity, unitPrice: priceById.get(i.offeringId)!,
  })));

  return order;
}

export async function acceptOrder(managerId: string, orderId: string): Promise<Order> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new HttpError(404, "Order not found");
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, order.businessId));
  if (biz.managerId !== managerId) throw new HttpError(403, "Not your business");
  if (order.status !== "pending") throw new HttpError(409, "Order not pending");

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) await decrementStock(it.offeringId, it.quantity);

  const partnerId = await findNearestPartner(order.businessId);
  const [updated] = await db.update(orders)
    .set({ status: partnerId ? "assigned" : "accepted", deliveryPartnerId: partnerId })
    .where(eq(orders.id, orderId)).returning();

  if (partnerId) await db.update(deliveryProfiles).set({ isAvailable: false }).where(eq(deliveryProfiles.userId, partnerId));
  return updated;
}

const NEXT: Record<string, string> = { assigned: "picked_up", picked_up: "delivered" };

export async function advanceOrderStatus(partnerId: string, orderId: string, to: "picked_up" | "delivered"): Promise<Order> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new HttpError(404, "Order not found");
  if (order.deliveryPartnerId !== partnerId) throw new HttpError(403, "Not your delivery");
  if (NEXT[order.status] !== to) throw new HttpError(409, `Illegal transition ${order.status} → ${to}`);

  const [updated] = await db.update(orders).set({ status: to }).where(eq(orders.id, orderId)).returning();
  if (to === "delivered") await db.update(deliveryProfiles).set({ isAvailable: true }).where(eq(deliveryProfiles.userId, partnerId));
  return updated;
}
