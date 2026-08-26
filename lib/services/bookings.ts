import { db } from "@/lib/db/client";
import { bookingRequests, offerings, businesses } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { eq } from "drizzle-orm";

export type Booking = typeof bookingRequests.$inferSelect;

export async function createBooking(userId: string, input: { offeringId: string; note?: string }): Promise<Booking> {
  const [off] = await db.select().from(offerings).where(eq(offerings.id, input.offeringId));
  if (!off) throw new HttpError(404, "Offering not found");
  if (off.type !== "service") throw new HttpError(400, "Only services can be booked");
  const [b] = await db.insert(bookingRequests).values({
    userId, businessId: off.businessId, offeringId: off.id, note: input.note, status: "requested",
  }).returning();
  return b;
}

export async function respondToBooking(managerId: string, bookingId: string, decision: "accepted" | "declined"): Promise<Booking> {
  const [bk] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, bookingId));
  if (!bk) throw new HttpError(404, "Booking not found");
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, bk.businessId));
  if (biz.managerId !== managerId) throw new HttpError(403, "Not your business");
  if (bk.status !== "requested") throw new HttpError(409, "Booking already handled");
  const [updated] = await db.update(bookingRequests).set({ status: decision }).where(eq(bookingRequests.id, bookingId)).returning();
  return updated;
}
