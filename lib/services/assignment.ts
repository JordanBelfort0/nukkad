import { db } from "@/lib/db/client";
import { businesses, deliveryProfiles, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function findNearestPartner(businessId: string): Promise<string | null> {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) return null;

  const distance = sql<number>`
    6371 * acos(
      least(1, greatest(-1,
        cos(radians(${b.lat})) * cos(radians(${deliveryProfiles.currentLat})) *
        cos(radians(${deliveryProfiles.currentLng}) - radians(${b.lng})) +
        sin(radians(${b.lat})) * sin(radians(${deliveryProfiles.currentLat}))
      ))
    )`;

  const rows = await db
    .select({ userId: deliveryProfiles.userId })
    .from(deliveryProfiles)
    .innerJoin(users, eq(users.id, deliveryProfiles.userId))
    .where(and(eq(deliveryProfiles.isAvailable, true), eq(users.city, b.city)))
    .orderBy(sql`${distance} ASC`)
    .limit(1);

  return rows[0]?.userId ?? null;
}
