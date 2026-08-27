import { db } from "@/lib/db/client";
import { businesses, offerings } from "@/lib/db/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
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
    // case-insensitive + whitespace-tolerant city match (users type "Mumbai"
    // vs a stored "mumbai"); exact eq would silently drop those results
    sql`lower(trim(${businesses.city})) = lower(trim(${p.city}))`,
    eq(businesses.isActive, true),
    eq(offerings.isAvailable, true),
  ];
  if (p.type) conds.push(eq(offerings.type, p.type));
  if (p.category) conds.push(eq(businesses.category, p.category));
  if (p.q) {
    // match the query across offering name/description AND the business
    // name/category, so "clothing" finds a clothing shop's products even
    // when the product name doesn't contain the word
    const like = `%${p.q.trim()}%`;
    // ILIKE handles substrings/prefixes ("sar" → "saree"); full-text search
    // adds English stemming so word forms match ("clothes" → "cloth" ← "Clothing")
    const fts = sql`to_tsvector('english',
        ${offerings.name} || ' ' || coalesce(${offerings.description}, '') || ' ' ||
        ${businesses.name} || ' ' || ${businesses.category}
      ) @@ plainto_tsquery('english', ${p.q.trim()})`;
    const qMatch = or(
      ilike(offerings.name, like),
      ilike(offerings.description, like),
      ilike(businesses.name, like),
      ilike(businesses.category, like),
      fts,
    );
    if (qMatch) conds.push(qMatch);
  }

  const rows = await db
    .select({ offering: offerings, business: businesses, distanceKm: distance, score })
    .from(offerings)
    .innerJoin(businesses, eq(offerings.businessId, businesses.id))
    .where(and(...conds))
    .orderBy(sql`${score} DESC`);

  return rows as SearchResult[];
}
