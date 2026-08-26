import { sql } from "@/lib/db/client";

export async function resetDb() {
  const [{ db }] = await sql`select current_database() as db`;
  if (!/_test$/.test(db)) throw new Error(`resetDb refused: not a _test database (got ${db})`);
  await sql`TRUNCATE reviews, booking_requests, order_items, orders, offerings, businesses, delivery_profiles, users RESTART IDENTITY CASCADE`;
}
