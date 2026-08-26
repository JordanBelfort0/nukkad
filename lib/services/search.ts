import { db } from "@/lib/db/client";
import { businesses, offerings } from "@/lib/db/schema";
import { and, eq, ilike, sql } from "drizzle-orm";
import type { Business, Offering } from "./catalog";

export interface SearchParams {
  q?: string; city: string; type?: "product" | "service"; category?: string; lat: number; lng: number;
}
export interface SearchResult { offering: Offering; business: Business; distanceKm: number; score: number; }

export async function searchOfferings(p: SearchParams): Promise<SearchResult[]> {
  const distance = sql<number>`
    6371 * acos(
      least(1, greatest(-1,
        cos(radians(${p.lat})) * cos(radians(${businesses.lat})) *
        cos(radians(${businesses.lng}) - radians(${p.lng})) +
        sin(radians(${p.lat})) * sin(radians(${businesses.lat}))
      ))
    )`;
  const score = sql<number>`${businesses.rating} - (${distance} * 0.1)`;

  const conds = [
    eq(businesses.city, p.city),
    eq(businesses.isActive, true),
    eq(offerings.isAvailable, true),
  ];
  if (p.type) conds.push(eq(offerings.type, p.type));
  if (p.category) conds.push(eq(businesses.category, p.category));
  if (p.q) conds.push(ilike(offerings.name, `%${p.q}%`));

  const rows = await db
    .select({ offering: offerings, business: businesses, distanceKm: distance, score })
    .from(offerings)
    .innerJoin(businesses, eq(offerings.businessId, businesses.id))
    .where(and(...conds))
    .orderBy(sql`${score} DESC`);

  return rows as SearchResult[];
}
