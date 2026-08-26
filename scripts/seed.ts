/**
 * Seed script for Local Commerce Platform (dev DB only).
 *
 * WARNING: This script TRUNCATES all application tables before inserting.
 * All existing dev data will be lost.
 *
 * Run with: npm run db:seed
 */

import { sql, db } from "@/lib/db/client";
import {
  users,
  businesses,
  offerings,
  deliveryProfiles,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";

  // Guard: refuse to run against the test database
  if (dbUrl.includes("neondb_test")) {
    console.error(
      "ERROR: DATABASE_URL points to neondb_test. This seed script must not run against the test database. Aborting."
    );
    process.exit(1);
  }

  console.log("\n⚠️  WARNING: About to TRUNCATE all application tables in the DEV database.");
  console.log("   All existing data will be permanently deleted.\n");

  // Truncate all tables in dependency order (child → parent)
  await sql`
    TRUNCATE
      reviews,
      booking_requests,
      order_items,
      orders,
      offerings,
      businesses,
      delivery_profiles,
      users
    RESTART IDENTITY CASCADE
  `;
  console.log("Tables truncated. Inserting seed data...\n");

  const CITY = "Jaipur";
  const PLAIN_PASSWORD = "password123";

  const pwHash = await hashPassword(PLAIN_PASSWORD);

  // ── Managers ──────────────────────────────────────────────────────────────
  const [manager1] = await db
    .insert(users)
    .values({
      name: "Priya Sharma",
      email: "priya.manager@example.com",
      phone: "9800000001",
      passwordHash: pwHash,
      role: "manager",
      city: CITY,
    })
    .returning();

  const [manager2] = await db
    .insert(users)
    .values({
      name: "Arjun Mehta",
      email: "arjun.manager@example.com",
      phone: "9800000002",
      passwordHash: pwHash,
      role: "manager",
      city: CITY,
    })
    .returning();

  // ── Businesses ─────────────────────────────────────────────────────────────
  // Business 1: product-based (grocery store)
  const [business1] = await db
    .insert(businesses)
    .values({
      managerId: manager1.id,
      name: "Priya's Fresh Mart",
      description: "Fresh groceries and daily essentials in Jaipur.",
      category: "Grocery",
      city: CITY,
      address: "12 Pink City Road, Jaipur",
      lat: 26.9124,
      lng: 75.7873,
      rating: 0,
      isActive: true,
    })
    .returning();

  // Business 2: service-based (salon)
  const [business2] = await db
    .insert(businesses)
    .values({
      managerId: manager2.id,
      name: "Arjun's Style Studio",
      description: "Premium hair and grooming services in Jaipur.",
      category: "Salon",
      city: CITY,
      address: "45 Bapu Nagar, Jaipur",
      lat: 26.9001,
      lng: 75.8010,
      rating: 0,
      isActive: true,
    })
    .returning();

  // ── Offerings ──────────────────────────────────────────────────────────────
  // Products for business 1
  await db.insert(offerings).values([
    {
      businessId: business1.id,
      type: "product",
      name: "Organic Basmati Rice (1 kg)",
      description: "Premium long-grain basmati rice, farm-fresh.",
      price: 120,
      stock: 50,
      isAvailable: true,
    },
    {
      businessId: business1.id,
      type: "product",
      name: "Cold-Pressed Mustard Oil (500 ml)",
      description: "Traditional cold-pressed mustard oil.",
      price: 85,
      stock: 30,
      isAvailable: true,
    },
  ]);

  // Services for business 2
  await db.insert(offerings).values([
    {
      businessId: business2.id,
      type: "service",
      name: "Haircut & Styling",
      description: "Classic haircut with blow-dry and styling.",
      price: 350,
      durationMinutes: 45,
      isAvailable: true,
    },
    {
      businessId: business2.id,
      type: "service",
      name: "Full-Body Massage",
      description: "Relaxing 60-minute full-body massage.",
      price: 900,
      durationMinutes: 60,
      isAvailable: true,
    },
  ]);

  // ── Delivery Partner ───────────────────────────────────────────────────────
  const [partner] = await db
    .insert(users)
    .values({
      name: "Ravi Kumar",
      email: "ravi.delivery@example.com",
      phone: "9800000003",
      passwordHash: pwHash,
      role: "delivery",
      city: CITY,
    })
    .returning();

  await db.insert(deliveryProfiles).values({
    userId: partner.id,
    vehicleType: "bike",
    isAvailable: true,
    currentLat: 26.9060, // near business1 and business2
    currentLng: 75.7940,
    rating: 0,
  });

  // ── Regular User ───────────────────────────────────────────────────────────
  await db.insert(users).values({
    name: "Sneha Gupta",
    email: "sneha.user@example.com",
    phone: "9800000004",
    passwordHash: pwHash,
    role: "user",
    city: CITY,
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("========================================");
  console.log("  Seed complete! Demo login credentials");
  console.log("========================================");
  console.log(`  Shared password : ${PLAIN_PASSWORD}`);
  console.log("");
  console.log("  Role      | Email");
  console.log("  ----------|------------------------------");
  console.log("  manager   | priya.manager@example.com   (Priya's Fresh Mart — products)");
  console.log("  manager   | arjun.manager@example.com   (Arjun's Style Studio — services)");
  console.log("  delivery  | ravi.delivery@example.com   (available, near Jaipur centre)");
  console.log("  user      | sneha.user@example.com      (regular customer)");
  console.log("========================================\n");

  await sql.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
