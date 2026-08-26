# Local Commerce Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first slice of a city-scoped local commerce marketplace — businesses list products/services, users search by city + vicinity + rating, products get an order → assign-partner → deliver loop, services get a booking request.

**Architecture:** A single full-stack Next.js (App Router) app on Node.js. Route handlers are thin and delegate to a service layer (`lib/services/`) that holds all business logic and is unit-tested against a real Postgres. Drizzle ORM defines the schema and migrations. Auth is email/password with a JWT session cookie and role guards.

**Tech Stack:** Next.js (App Router, TypeScript), Postgres, Drizzle ORM + drizzle-kit, postgres.js driver, Zod, jose (JWT), bcryptjs, Tailwind CSS + shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-local-commerce-platform-design.md`

## Global Constraints

- **Runtime:** Node.js (not Edge) for all route handlers — auth, bcrypt, and postgres.js need the Node runtime.
- **Roles:** exactly three — `'manager' | 'user' | 'delivery'`.
- **Offering types:** exactly two — `'product' | 'service'`.
- **Order status values:** `'pending' | 'accepted' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled'` (exact strings).
- **Booking status values:** `'requested' | 'accepted' | 'declined' | 'completed'` (exact strings).
- **One order = one business.** No cross-business carts.
- **No payments, no live tracking, no service scheduling** in this slice.
- **Distance** = haversine over `lat`/`lng` (kilometers). No PostGIS.
- **Search ranking score** (exact formula, used in tests): `score = business.rating - (distance_km * 0.1)`, ordered descending.
- **Ratings are derived** — `businesses.rating` = average of that business's reviews (default `0` when none).
- Every mutating route is role-guarded. Users cannot order from their own business.
- Tests run against a real Postgres pointed at by `DATABASE_URL` in `.env.test`.

---

## File Structure

```
app/
  layout.tsx, globals.css, page.tsx        landing
  (auth)/login/page.tsx, signup/page.tsx
  (user)/search/page.tsx
  (user)/business/[id]/page.tsx
  (user)/orders/page.tsx
  (manager)/dashboard/page.tsx
  (manager)/offerings/page.tsx
  (delivery)/dashboard/page.tsx
  api/auth/{signup,login,logout}/route.ts
  api/search/route.ts
  api/businesses/route.ts
  api/businesses/[id]/route.ts
  api/offerings/route.ts
  api/offerings/[id]/route.ts
  api/orders/route.ts
  api/orders/[id]/route.ts
  api/orders/[id]/status/route.ts
  api/manager/orders/route.ts
  api/bookings/route.ts
  api/bookings/[id]/route.ts
  api/reviews/route.ts
  api/delivery/availability/route.ts
  api/delivery/jobs/route.ts
lib/
  db/schema.ts            Drizzle tables
  db/client.ts            db connection
  auth/password.ts        bcrypt hash/verify
  auth/session.ts         JWT sign/verify, cookie helpers, requireRole
  services/catalog.ts     businesses + offerings CRUD, stock
  services/search.ts      ranking query
  services/orders.ts      create, accept, transitions, stock
  services/assignment.ts  nearest-available partner
  services/bookings.ts    service booking requests
  services/reviews.ts     insert + recompute rating
  validation/schemas.ts   Zod schemas for all inputs
drizzle.config.ts
vitest.config.ts
tests/
  helpers/db.ts           test DB reset/seed helpers
  services/*.test.ts
```

---

## Task 1: Project scaffold, DB connection, and a passing test

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`, `.env.example`, `.env`, `.env.test`, `.gitignore`
- Create: `lib/db/client.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle client) exported from `lib/db/client.ts`.

- [ ] **Step 1: Scaffold Next.js app**

Run (non-interactive):
```bash
npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir=false --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Install dependencies**

```bash
npm i drizzle-orm postgres zod jose bcryptjs
npm i -D drizzle-kit vitest @types/bcryptjs dotenv tsx
```

- [ ] **Step 3: Create env files**

`.env.example`:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/localcommerce
JWT_SECRET=change-me-in-prod-min-32-chars-long-string
```
Copy to `.env` (dev DB) and `.env.test` (a **separate** DB, e.g. `localcommerce_test`). Add `.env` and `.env.test` to `.gitignore` (keep `.env.example` tracked).

- [ ] **Step 4: Create the DB client**

`lib/db/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
// max:1 keeps connections predictable in serverless + tests
export const sql = postgres(connectionString, { max: 1 });
export const db = drizzle(sql, { schema });
```
(Note: `./schema` is created in Task 2. If `create-next-app` complains about the missing import at this step, stub `lib/db/schema.ts` with `export {}` — Task 2 replaces it.)

- [ ] **Step 5: Configure Vitest to load `.env.test`**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test" });

export default defineConfig({
  test: { environment: "node", globals: true, fileParallelism: false },
});
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 6: Write a smoke test**

`tests/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
import { sql } from "@/lib/db/client";

test("database connection works", async () => {
  const rows = await sql`select 1 as ok`;
  expect(rows[0].ok).toBe(1);
});
```

- [ ] **Step 7: Create the test database, run the test**

```bash
createdb localcommerce_test || true
npm test
```
Expected: PASS (connects to `.env.test` DB, returns `ok: 1`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Drizzle + Vitest"
```

---

## Task 2: Database schema & migration

**Files:**
- Create: `lib/db/schema.ts`
- Create: `drizzle.config.ts`
- Create: `tests/helpers/db.ts`
- Test: `tests/services/schema.test.ts`

**Interfaces:**
- Produces: table objects `users, deliveryProfiles, businesses, offerings, orders, orderItems, bookingRequests, reviews` and the enums `roleEnum, offeringTypeEnum, orderStatusEnum, bookingStatusEnum` from `lib/db/schema.ts`.
- Produces: `resetDb()` from `tests/helpers/db.ts` — truncates all tables.

- [ ] **Step 1: Write the schema**

`lib/db/schema.ts`:
```ts
import { pgTable, pgEnum, uuid, text, integer, doublePrecision, boolean, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["manager", "user", "delivery"]);
export const offeringTypeEnum = pgEnum("offering_type", ["product", "service"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "accepted", "assigned", "picked_up", "delivered", "cancelled"]);
export const bookingStatusEnum = pgEnum("booking_status", ["requested", "accepted", "declined", "completed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deliveryProfiles = pgTable("delivery_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  vehicleType: text("vehicle_type").notNull(),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  rating: doublePrecision("rating").notNull().default(0),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  managerId: uuid("manager_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  rating: doublePrecision("rating").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const offerings = pgTable("offerings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  type: offeringTypeEnum("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  stock: integer("stock"),                 // products only
  durationMinutes: integer("duration_minutes"), // services only
  isAvailable: boolean("is_available").notNull().default(true),
  imageUrl: text("image_url"),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  deliveryPartnerId: uuid("delivery_partner_id").references(() => users.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLat: doublePrecision("delivery_lat").notNull(),
  deliveryLng: doublePrecision("delivery_lng").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  offeringId: uuid("offering_id").notNull().references(() => offerings.id),
  quantity: integer("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").notNull(),
});

export const bookingRequests = pgTable("booking_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  offeringId: uuid("offering_id").notNull().references(() => offerings.id),
  status: bookingStatusEnum("status").notNull().default("requested"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  orderId: uuid("order_id").references(() => orders.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Configure drizzle-kit**

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```
Add scripts to `package.json`: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:push": "drizzle-kit push"`.

- [ ] **Step 3: Generate & apply the migration to both DBs**

```bash
npm run db:generate
DATABASE_URL=$(grep DATABASE_URL .env | cut -d= -f2-) npm run db:migrate
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2-) npm run db:migrate
```

- [ ] **Step 4: Write the test DB reset helper**

`tests/helpers/db.ts`:
```ts
import { sql } from "@/lib/db/client";

export async function resetDb() {
  await sql`TRUNCATE reviews, booking_requests, order_items, orders, offerings, businesses, delivery_profiles, users RESTART IDENTITY CASCADE`;
}
```

- [ ] **Step 5: Write the schema test**

`tests/services/schema.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { resetDb } from "../helpers/db";

beforeEach(resetDb);

test("can insert and read a user", async () => {
  const [u] = await db.insert(users).values({
    name: "Asha", email: "asha@example.com", passwordHash: "x", role: "manager", city: "Jaipur",
  }).returning();
  expect(u.id).toBeTruthy();
  expect(u.role).toBe("manager");
});
```

- [ ] **Step 6: Run the test**

Run: `npm test -- tests/services/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add database schema and migration"
```

---

## Task 3: Password hashing & JWT session

**Files:**
- Create: `lib/auth/password.ts`, `lib/auth/session.ts`
- Test: `tests/services/auth.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` from `lib/auth/password.ts`.
- Produces: `signSession(payload: { userId: string; role: Role }): Promise<string>`, `verifySession(token: string): Promise<{ userId: string; role: Role } | null>` from `lib/auth/session.ts`. `Role = 'manager' | 'user' | 'delivery'`.

- [ ] **Step 1: Write failing tests**

`tests/services/auth.test.ts`:
```ts
import { expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession, verifySession } from "@/lib/auth/session";

test("password hashes and verifies", async () => {
  const hash = await hashPassword("secret123");
  expect(hash).not.toBe("secret123");
  expect(await verifyPassword("secret123", hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
});

test("session token round-trips", async () => {
  const token = await signSession({ userId: "u1", role: "user" });
  const payload = await verifySession(token);
  expect(payload).toEqual({ userId: "u1", role: "user" });
});

test("tampered token returns null", async () => {
  expect(await verifySession("not.a.token")).toBeNull();
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npm test -- tests/services/auth.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement password helpers**

`lib/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";
export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
```

- [ ] **Step 4: Implement session helpers**

`lib/auth/session.ts`:
```ts
import { SignJWT, jwtVerify } from "jose";

export type Role = "manager" | "user" | "delivery";
export interface SessionPayload { userId: string; role: Role }

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.userId as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- tests/services/auth.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add password hashing and JWT session helpers"
```

---

## Task 4: Auth cookie helpers, role guard & auth API routes

**Files:**
- Modify: `lib/auth/session.ts` (add cookie + guard helpers)
- Create: `lib/validation/schemas.ts`
- Create: `app/api/auth/signup/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`
- Test: `tests/services/auth-routes.test.ts`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, `hashPassword`, `verifyPassword`, `db`, `users`, `deliveryProfiles`.
- Produces: `getSession(): Promise<SessionPayload | null>` (reads the cookie), `setSessionCookie(token)`, `clearSessionCookie()`, `requireRole(...roles: Role[]): Promise<SessionPayload>` (throws `HttpError(403)` on mismatch, `HttpError(401)` when unauthenticated) from `lib/auth/session.ts`.
- Produces: `HttpError` class (`status`, `message`) — put it in `lib/auth/session.ts` and re-export, or a small `lib/http.ts`. Use `lib/http.ts`.
- Produces: Zod schemas `signupSchema`, `loginSchema` from `lib/validation/schemas.ts`.

- [ ] **Step 1: Write failing route tests**

`tests/services/auth-routes.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";

beforeEach(resetDb);

function req(body: unknown) {
  return new Request("http://t/api/auth", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

test("signup creates a user and sets a cookie", async () => {
  const res = await signup(req({ name: "Asha", email: "a@e.com", password: "secret123", role: "manager", city: "Jaipur" }));
  expect(res.status).toBe(201);
  expect(res.headers.get("set-cookie")).toContain("session=");
});

test("login rejects wrong password", async () => {
  await signup(req({ name: "Asha", email: "a@e.com", password: "secret123", role: "user", city: "Jaipur" }));
  const res = await login(req({ email: "a@e.com", password: "nope" }));
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/auth-routes.test.ts`
Expected: FAIL (routes missing).

- [ ] **Step 3: Add HttpError**

`lib/http.ts`:
```ts
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Internal error" }, { status: 500 });
}
```

- [ ] **Step 4: Add cookie + guard helpers to `lib/auth/session.ts`**

Append:
```ts
import { cookies } from "next/headers";

const COOKIE = "session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
export async function clearSessionCookie() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifySession(token) : null;
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Not authenticated");
  if (!roles.includes(s.role)) throw new HttpError(403, "Forbidden");
  return s;
}
```
Add `import { HttpError } from "@/lib/http";` at the top.

- [ ] **Step 5: Add validation schemas**

`lib/validation/schemas.ts`:
```ts
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["manager", "user", "delivery"]),
  city: z.string().min(1),
  vehicleType: z.string().optional(), // required when role=delivery (checked in route)
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string() });
```

- [ ] **Step 6: Implement signup route**

`app/api/auth/signup/route.ts`:
```ts
import { db } from "@/lib/db/client";
import { users, deliveryProfiles } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { signupSchema } from "@/lib/validation/schemas";
import { HttpError, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const data = signupSchema.parse(await req.json());
    const existing = await db.select().from(users).where(eq(users.email, data.email));
    if (existing.length) throw new HttpError(409, "Email already registered");
    if (data.role === "delivery" && !data.vehicleType) throw new HttpError(400, "vehicleType required for delivery");

    const [u] = await db.insert(users).values({
      name: data.name, email: data.email, phone: data.phone,
      passwordHash: await hashPassword(data.password), role: data.role, city: data.city,
    }).returning();

    if (data.role === "delivery") {
      await db.insert(deliveryProfiles).values({ userId: u.id, vehicleType: data.vehicleType! });
    }

    const token = await signSession({ userId: u.id, role: u.role });
    await setSessionCookie(token);
    return Response.json({ id: u.id, role: u.role }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
```

- [ ] **Step 7: Implement login & logout routes**

`app/api/auth/login/route.ts`:
```ts
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { HttpError, errorResponse } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, password } = loginSchema.parse(await req.json());
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u || !(await verifyPassword(password, u.passwordHash))) throw new HttpError(401, "Invalid credentials");
    await setSessionCookie(await signSession({ userId: u.id, role: u.role }));
    return Response.json({ id: u.id, role: u.role });
  } catch (e) { return errorResponse(e); }
}
```
`app/api/auth/logout/route.ts`:
```ts
import { clearSessionCookie } from "@/lib/auth/session";
export const runtime = "nodejs";
export async function POST() { await clearSessionCookie(); return Response.json({ ok: true }); }
```

- [ ] **Step 8: Run tests, verify pass**

Run: `npm test -- tests/services/auth-routes.test.ts`
Expected: PASS. (If `cookies()` throws outside a request scope in tests, the assertions read `res.headers.get("set-cookie")` — ensure routes return the cookie via the Response. If Next's `cookies()` is unavailable in unit context, set the cookie header directly on the Response instead; document whichever the executor uses.)

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add auth routes, role guard, and cookie session"
```

---

## Task 5: Catalog service — businesses & offerings

**Files:**
- Create: `lib/services/catalog.ts`
- Modify: `lib/validation/schemas.ts` (add business/offering schemas)
- Test: `tests/services/catalog.test.ts`

**Interfaces:**
- Consumes: `db`, `businesses`, `offerings`.
- Produces from `lib/services/catalog.ts`:
  - `createBusiness(managerId: string, input: BusinessInput): Promise<Business>`
  - `getBusinessWithOfferings(id: string): Promise<{ business: Business; offerings: Offering[] } | null>`
  - `createOffering(managerId: string, input: OfferingInput): Promise<Offering>` — throws `HttpError(403)` if the business isn't the manager's, `HttpError(400)` if a product has no `stock` or a service has no `durationMinutes`.
  - `updateOffering(managerId, offeringId, patch): Promise<Offering>`
  - `deleteOffering(managerId, offeringId): Promise<void>`
  - `decrementStock(offeringId, qty): Promise<void>` — throws `HttpError(409)` if insufficient stock.

- [ ] **Step 1: Write failing tests**

`tests/services/catalog.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createBusiness, createOffering, getBusinessWithOfferings, decrementStock } from "@/lib/services/catalog";

async function makeManager() {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  return m;
}
beforeEach(resetDb);

test("manager creates a business and a product offering", async () => {
  const m = await makeManager();
  const b = await createBusiness(m.id, { name: "Kurta Co", category: "clothing", city: "Jaipur", address: "MI Rd", lat: 26.91, lng: 75.78 });
  const o = await createOffering(m.id, { businessId: b.id, type: "product", name: "Red Kurta", price: 1200, stock: 5 });
  const full = await getBusinessWithOfferings(b.id);
  expect(full?.offerings).toHaveLength(1);
  expect(o.stock).toBe(5);
});

test("product without stock is rejected", async () => {
  const m = await makeManager();
  const b = await createBusiness(m.id, { name: "X", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 });
  await expect(createOffering(m.id, { businessId: b.id, type: "product", name: "No stock", price: 10 } as any)).rejects.toThrow();
});

test("decrementStock rejects when insufficient", async () => {
  const m = await makeManager();
  const b = await createBusiness(m.id, { name: "X", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 });
  const o = await createOffering(m.id, { businessId: b.id, type: "product", name: "P", price: 10, stock: 2 });
  await expect(decrementStock(o.id, 5)).rejects.toThrow();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/catalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add validation schemas**

Append to `lib/validation/schemas.ts`:
```ts
export const businessSchema = z.object({
  name: z.string().min(1), description: z.string().optional(),
  category: z.string().min(1), city: z.string().min(1), address: z.string().min(1),
  lat: z.number(), lng: z.number(),
});
export const offeringSchema = z.object({
  businessId: z.string().uuid(), type: z.enum(["product", "service"]),
  name: z.string().min(1), description: z.string().optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
}).refine(d => d.type !== "product" || d.stock != null, { message: "stock required for product" })
  .refine(d => d.type !== "service" || d.durationMinutes != null, { message: "durationMinutes required for service" });
```

- [ ] **Step 4: Implement the catalog service**

`lib/services/catalog.ts`:
```ts
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

export async function decrementStock(offeringId: string, qty: number): Promise<void> {
  const res = await db.update(offerings)
    .set({ stock: sql`${offerings.stock} - ${qty}` })
    .where(and(eq(offerings.id, offeringId), sql`${offerings.stock} >= ${qty}`))
    .returning();
  if (res.length === 0) throw new HttpError(409, "Insufficient stock");
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- tests/services/catalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add catalog service for businesses and offerings"
```

---

## Task 6: Search service — city filter + vicinity + rating rank

**Files:**
- Create: `lib/services/search.ts`
- Test: `tests/services/search.test.ts`

**Interfaces:**
- Consumes: `db`, `businesses`, `offerings`.
- Produces: `searchOfferings(params: SearchParams): Promise<SearchResult[]>` from `lib/services/search.ts`.
  - `SearchParams = { q?: string; city: string; type?: 'product'|'service'; category?: string; lat: number; lng: number }`
  - `SearchResult = { offering: Offering; business: Business; distanceKm: number; score: number }`
  - Ordered by `score = business.rating - distanceKm * 0.1` descending. Only `city`-matching, active businesses, available offerings.

- [ ] **Step 1: Write failing test**

`tests/services/search.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, offerings } from "@/lib/db/schema";
import { searchOfferings } from "@/lib/services/search";

beforeEach(resetDb);

async function seedBiz(name: string, lat: number, lng: number, rating: number, city = "Jaipur") {
  const [m] = await db.insert(users).values({ name, email: `${name}@e.com`, passwordHash: "x", role: "manager", city }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name, category: "clothing", city, address: "a", lat, lng, rating }).returning();
  await db.insert(offerings).values({ businessId: b.id, type: "product", name: `${name} kurta`, price: 100, stock: 3 });
  return b;
}

test("ranks nearer + higher-rated first and filters by city", async () => {
  // user at (26.91, 75.78)
  await seedBiz("Near", 26.91, 75.78, 4.0);   // ~0km, score ≈ 4.0
  await seedBiz("Far", 27.5, 75.78, 5.0);      // ~65km, score ≈ 5.0 - 6.5 = -1.5
  await seedBiz("OtherCity", 26.91, 75.78, 5.0, "Delhi"); // excluded

  const results = await searchOfferings({ city: "Jaipur", lat: 26.91, lng: 75.78 });
  expect(results.map(r => r.business.name)).toEqual(["Near", "Far"]);
  expect(results[0].distanceKm).toBeLessThan(1);
});

test("type filter works", async () => {
  await seedBiz("Near", 26.91, 75.78, 4.0);
  const products = await searchOfferings({ city: "Jaipur", lat: 26.91, lng: 75.78, type: "service" });
  expect(products).toHaveLength(0);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/search.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement search**

`lib/services/search.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/services/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add city + vicinity + rating search ranking"
```

---

## Task 7: Assignment service — nearest available partner

**Files:**
- Create: `lib/services/assignment.ts`
- Test: `tests/services/assignment.test.ts`

**Interfaces:**
- Consumes: `db`, `deliveryProfiles`, `users`, `businesses`.
- Produces: `findNearestPartner(businessId: string): Promise<string | null>` — returns the `userId` of the nearest available delivery partner in the same city as the business, or `null` if none. from `lib/services/assignment.ts`.

- [ ] **Step 1: Write failing test**

`tests/services/assignment.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, deliveryProfiles } from "@/lib/db/schema";
import { findNearestPartner } from "@/lib/services/assignment";

beforeEach(resetDb);

async function partner(name: string, lat: number, lng: number, available: boolean, city = "Jaipur") {
  const [u] = await db.insert(users).values({ name, email: `${name}@e.com`, passwordHash: "x", role: "delivery", city }).returning();
  await db.insert(deliveryProfiles).values({ userId: u.id, vehicleType: "bike", isAvailable: available, currentLat: lat, currentLng: lng });
  return u;
}

test("picks nearest available partner in the city", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 26.91, lng: 75.78, rating: 0 }).returning();

  const near = await partner("near", 26.92, 75.78, true);
  await partner("far", 27.5, 75.78, true);
  await partner("busy", 26.91, 75.78, false); // closest but unavailable

  expect(await findNearestPartner(b.id)).toBe(near.id);
});

test("returns null when nobody available", async () => {
  const [m] = await db.insert(users).values({ name: "M2", email: "m2@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 26.91, lng: 75.78, rating: 0 }).returning();
  await partner("busy", 26.91, 75.78, false);
  expect(await findNearestPartner(b.id)).toBeNull();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/assignment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement assignment**

`lib/services/assignment.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/services/assignment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add nearest-available delivery partner assignment"
```

---

## Task 8: Orders service — create, accept (auto-assign), transitions

**Files:**
- Create: `lib/services/orders.ts`
- Modify: `lib/validation/schemas.ts` (add order schema)
- Test: `tests/services/orders.test.ts`

**Interfaces:**
- Consumes: `db`, `orders`, `orderItems`, `offerings`, `businesses`, `deliveryProfiles`, `decrementStock`, `findNearestPartner`.
- Produces from `lib/services/orders.ts`:
  - `createOrder(userId: string, input: OrderInput): Promise<Order>` — validates all items belong to one `businessId`, that the user is not that business's manager (`HttpError(403)`), computes `totalAmount`, inserts `orders` (`pending`) + `orderItems`.
  - `acceptOrder(managerId: string, orderId: string): Promise<Order>` — asserts manager owns the business, decrements stock per item, sets `accepted`, then auto-assigns: if a partner is found sets `assigned` + `deliveryPartnerId` + marks partner busy; else leaves `accepted`.
  - `advanceOrderStatus(partnerId: string, orderId: string, to: 'picked_up' | 'delivered'): Promise<Order>` — asserts the order is assigned to this partner, enforces legal transition (`assigned→picked_up→delivered`); on `delivered` frees the partner (`isAvailable=true`).
  - `OrderInput = { businessId: string; items: { offeringId: string; quantity: number }[]; deliveryAddress: string; deliveryLat: number; deliveryLng: number }`
  - `Order = typeof orders.$inferSelect`

- [ ] **Step 1: Write failing tests**

`tests/services/orders.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, offerings, deliveryProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createOrder, acceptOrder, advanceOrderStatus } from "@/lib/services/orders";

beforeEach(resetDb);

async function seed() {
  const [mgr] = await db.insert(users).values({ name: "Mgr", email: "mgr@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [usr] = await db.insert(users).values({ name: "Usr", email: "usr@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [biz] = await db.insert(businesses).values({ managerId: mgr.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 26.91, lng: 75.78, rating: 0 }).returning();
  const [off] = await db.insert(offerings).values({ businessId: biz.id, type: "product", name: "P", price: 100, stock: 5 }).returning();
  const [par] = await db.insert(users).values({ name: "Par", email: "par@e.com", passwordHash: "x", role: "delivery", city: "Jaipur" }).returning();
  await db.insert(deliveryProfiles).values({ userId: par.id, vehicleType: "bike", isAvailable: true, currentLat: 26.91, currentLng: 75.78 });
  return { mgr, usr, biz, off, par };
}

test("create → accept auto-assigns and decrements stock", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 2 }], deliveryAddress: "home", deliveryLat: 26.91, deliveryLng: 75.78 });
  expect(order.status).toBe("pending");
  expect(order.totalAmount).toBe(200);

  const accepted = await acceptOrder(mgr.id, order.id);
  expect(accepted.status).toBe("assigned");
  expect(accepted.deliveryPartnerId).toBe(par.id);
  const [o] = await db.select().from(offerings).where(eq(offerings.id, off.id));
  expect(o.stock).toBe(3);
  const [p] = await db.select().from(deliveryProfiles).where(eq(deliveryProfiles.userId, par.id));
  expect(p.isAvailable).toBe(false);
});

test("no partner → stays accepted", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  await db.update(deliveryProfiles).set({ isAvailable: false }).where(eq(deliveryProfiles.userId, par.id));
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  const accepted = await acceptOrder(mgr.id, order.id);
  expect(accepted.status).toBe("accepted");
  expect(accepted.deliveryPartnerId).toBeNull();
});

test("delivery transitions and frees partner", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  await acceptOrder(mgr.id, order.id);
  const picked = await advanceOrderStatus(par.id, order.id, "picked_up");
  expect(picked.status).toBe("picked_up");
  const delivered = await advanceOrderStatus(par.id, order.id, "delivered");
  expect(delivered.status).toBe("delivered");
  const [p] = await db.select().from(deliveryProfiles).where(eq(deliveryProfiles.userId, par.id));
  expect(p.isAvailable).toBe(true);
});

test("cannot deliver before picked_up", async () => {
  const { mgr, usr, biz, off, par } = await seed();
  const order = await createOrder(usr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 26.91, deliveryLng: 75.78 });
  await acceptOrder(mgr.id, order.id);
  await expect(advanceOrderStatus(par.id, order.id, "delivered")).rejects.toThrow();
});

test("user cannot order from own business", async () => {
  const { mgr, biz, off } = await seed();
  await expect(createOrder(mgr.id, { businessId: biz.id, items: [{ offeringId: off.id, quantity: 1 }], deliveryAddress: "h", deliveryLat: 1, deliveryLng: 1 })).rejects.toThrow();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/orders.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add order schema**

Append to `lib/validation/schemas.ts`:
```ts
export const orderSchema = z.object({
  businessId: z.string().uuid(),
  items: z.array(z.object({ offeringId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
  deliveryAddress: z.string().min(1),
  deliveryLat: z.number(), deliveryLng: z.number(),
});
```

- [ ] **Step 4: Implement the orders service**

`lib/services/orders.ts`:
```ts
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
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- tests/services/orders.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add orders service with auto-assign and state machine"
```

---

## Task 9: Bookings service — service requests

**Files:**
- Create: `lib/services/bookings.ts`
- Modify: `lib/validation/schemas.ts` (add booking schema)
- Test: `tests/services/bookings.test.ts`

**Interfaces:**
- Consumes: `db`, `bookingRequests`, `offerings`, `businesses`.
- Produces from `lib/services/bookings.ts`:
  - `createBooking(userId: string, input: { offeringId: string; note?: string }): Promise<Booking>` — resolves the offering's business, requires `type==='service'` (`HttpError(400)`), inserts `requested`.
  - `respondToBooking(managerId: string, bookingId: string, decision: 'accepted' | 'declined'): Promise<Booking>` — asserts manager owns the business; only from `requested`.
  - `Booking = typeof bookingRequests.$inferSelect`

- [ ] **Step 1: Write failing tests**

`tests/services/bookings.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses, offerings } from "@/lib/db/schema";
import { createBooking, respondToBooking } from "@/lib/services/bookings";

beforeEach(resetDb);

async function seed(type: "product" | "service") {
  const [mgr] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [usr] = await db.insert(users).values({ name: "U", email: "u@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [biz] = await db.insert(businesses).values({ managerId: mgr.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1, rating: 0 }).returning();
  const [off] = await db.insert(offerings).values({ businessId: biz.id, type, name: "X", price: 100, ...(type === "service" ? { durationMinutes: 60 } : { stock: 5 }) }).returning();
  return { mgr, usr, biz, off };
}

test("user books a service, manager accepts", async () => {
  const { mgr, usr, off } = await seed("service");
  const b = await createBooking(usr.id, { offeringId: off.id, note: "morning please" });
  expect(b.status).toBe("requested");
  const accepted = await respondToBooking(mgr.id, b.id, "accepted");
  expect(accepted.status).toBe("accepted");
});

test("cannot book a product as a service", async () => {
  const { usr, off } = await seed("product");
  await expect(createBooking(usr.id, { offeringId: off.id })).rejects.toThrow();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/bookings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add booking schema**

Append to `lib/validation/schemas.ts`:
```ts
export const bookingSchema = z.object({ offeringId: z.string().uuid(), note: z.string().optional() });
```

- [ ] **Step 4: Implement bookings service**

`lib/services/bookings.ts`:
```ts
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
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- tests/services/bookings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add service booking requests"
```

---

## Task 10: Reviews service — insert + recompute rating

**Files:**
- Create: `lib/services/reviews.ts`
- Modify: `lib/validation/schemas.ts` (add review schema)
- Test: `tests/services/reviews.test.ts`

**Interfaces:**
- Consumes: `db`, `reviews`, `businesses`, `orders`.
- Produces: `createReview(userId: string, input: { businessId: string; orderId?: string; rating: number; comment?: string }): Promise<Review>` from `lib/services/reviews.ts` — inserts the review, then sets `businesses.rating` to the AVG of all that business's review ratings. `Review = typeof reviews.$inferSelect`.

- [ ] **Step 1: Write failing test**

`tests/services/reviews.test.ts`:
```ts
import { beforeEach, expect, test } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users, businesses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createReview } from "@/lib/services/reviews";

beforeEach(resetDb);

test("review recomputes business average rating", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const [u1] = await db.insert(users).values({ name: "U1", email: "u1@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [u2] = await db.insert(users).values({ name: "U2", email: "u2@e.com", passwordHash: "x", role: "user", city: "Jaipur" }).returning();
  const [b] = await db.insert(businesses).values({ managerId: m.id, name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1, rating: 0 }).returning();

  await createReview(u1.id, { businessId: b.id, rating: 4 });
  await createReview(u2.id, { businessId: b.id, rating: 2 });
  const [after] = await db.select().from(businesses).where(eq(businesses.id, b.id));
  expect(after.rating).toBe(3);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/reviews.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add review schema**

Append to `lib/validation/schemas.ts`:
```ts
export const reviewSchema = z.object({
  businessId: z.string().uuid(), orderId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5), comment: z.string().optional(),
});
```

- [ ] **Step 4: Implement reviews service**

`lib/services/reviews.ts`:
```ts
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
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- tests/services/reviews.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add reviews service with rating recompute"
```

---

## Task 11: API route handlers (business, offerings, search, orders, delivery, bookings, reviews)

**Files:**
- Create: `app/api/search/route.ts`, `app/api/businesses/route.ts`, `app/api/businesses/[id]/route.ts`, `app/api/offerings/route.ts`, `app/api/offerings/[id]/route.ts`, `app/api/orders/route.ts`, `app/api/manager/orders/route.ts`, `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/status/route.ts`, `app/api/delivery/availability/route.ts`, `app/api/delivery/jobs/route.ts`, `app/api/bookings/route.ts`, `app/api/bookings/[id]/route.ts`, `app/api/reviews/route.ts`
- Test: `tests/services/api.test.ts`

**Interfaces:**
- Consumes: all services + `requireRole` + Zod schemas. Each handler: `runtime = "nodejs"`, parse/validate, call the service, wrap in `errorResponse`.
- Produces: the REST surface from the spec §6.

- [ ] **Step 1: Write a representative failing integration test**

`tests/services/api.test.ts`:
```ts
import { beforeEach, expect, test, vi } from "vitest";
import { resetDb } from "../helpers/db";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

// Mock the session so requireRole returns a chosen identity.
let current: { userId: string; role: "manager" | "user" | "delivery" } | null = null;
vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  getSession: async () => current,
  requireRole: async (...roles: string[]) => {
    if (!current) throw new (await import("@/lib/http")).HttpError(401, "no");
    if (!roles.includes(current.role)) throw new (await import("@/lib/http")).HttpError(403, "no");
    return current;
  },
  setSessionCookie: async () => {}, clearSessionCookie: async () => {},
}));

beforeEach(async () => { await resetDb(); current = null; });

function jsonReq(body: unknown) {
  return new Request("http://t", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

test("manager creates business via API, non-manager is forbidden", async () => {
  const [m] = await db.insert(users).values({ name: "M", email: "m@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const { POST } = await import("@/app/api/businesses/route");

  current = { userId: m.id, role: "user" };
  const forbidden = await POST(jsonReq({ name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 }));
  expect(forbidden.status).toBe(403);

  current = { userId: m.id, role: "manager" };
  const ok = await POST(jsonReq({ name: "B", category: "c", city: "Jaipur", address: "a", lat: 1, lng: 1 }));
  expect(ok.status).toBe(201);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- tests/services/api.test.ts`
Expected: FAIL (route missing).

- [ ] **Step 3: Implement the handlers**

Pattern (apply to each). Example `app/api/businesses/route.ts`:
```ts
import { requireRole } from "@/lib/auth/session";
import { businessSchema } from "@/lib/validation/schemas";
import { createBusiness } from "@/lib/services/catalog";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const s = await requireRole("manager");
    const data = businessSchema.parse(await req.json());
    const b = await createBusiness(s.userId, data);
    return Response.json(b, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
```
`app/api/businesses/[id]/route.ts` (public GET):
```ts
import { getBusinessWithOfferings } from "@/lib/services/catalog";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getBusinessWithOfferings(id);
    if (!data) throw new HttpError(404, "Not found");
    return Response.json(data);
  } catch (e) { return errorResponse(e); }
}
```
`app/api/search/route.ts` (public GET, reads query params):
```ts
import { searchOfferings } from "@/lib/services/search";
import { errorResponse, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const city = u.searchParams.get("city");
    const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
    if (!city || Number.isNaN(lat) || Number.isNaN(lng)) throw new HttpError(400, "city, lat, lng required");
    const type = u.searchParams.get("type") as "product" | "service" | null;
    const results = await searchOfferings({
      city, lat, lng, q: u.searchParams.get("q") ?? undefined,
      category: u.searchParams.get("category") ?? undefined, type: type ?? undefined,
    });
    return Response.json(results);
  } catch (e) { return errorResponse(e); }
}
```
`app/api/offerings/route.ts` → `requireRole("manager")`, `offeringSchema`, `createOffering(s.userId, data)`, 201.
`app/api/offerings/[id]/route.ts` → `PATCH` (`updateOffering`), `DELETE` (`deleteOffering`), both `requireRole("manager")`.
`app/api/orders/route.ts` → `POST` `requireRole("user")` + `orderSchema` → `createOrder`; `GET` `requireRole("user")` → orders where `userId = s.userId`.
`app/api/manager/orders/route.ts` → `GET` `requireRole("manager")` → orders joined to businesses the manager owns.
`app/api/orders/[id]/route.ts` → `PATCH` `requireRole("manager")` → `acceptOrder(s.userId, id)`.
`app/api/orders/[id]/status/route.ts` → `PATCH` `requireRole("delivery")` + body `{ to: "picked_up" | "delivered" }` → `advanceOrderStatus(s.userId, id, to)`.
`app/api/delivery/availability/route.ts` → `PATCH` `requireRole("delivery")` + body `{ isAvailable, lat, lng }` → update `deliveryProfiles`.
`app/api/delivery/jobs/route.ts` → `GET` `requireRole("delivery")` → orders where `deliveryPartnerId = s.userId` and status in (`assigned`,`picked_up`).
`app/api/bookings/route.ts` → `POST` `requireRole("user")` + `bookingSchema` → `createBooking`; `GET` → user's bookings.
`app/api/bookings/[id]/route.ts` → `PATCH` `requireRole("manager")` + body `{ decision: "accepted" | "declined" }` → `respondToBooking`.
`app/api/reviews/route.ts` → `POST` `requireRole("user")` + `reviewSchema` → `createReview`.

For the delivery-availability and jobs handlers, add the needed imports (`db`, `deliveryProfiles`, `orders`, `eq`, `and`, `inArray`).

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/services/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all service + API tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add REST API route handlers for all resources"
```

---

## Task 12: Auth UI — signup & login pages

**Files:**
- Create: `app/(auth)/signup/page.tsx`, `app/(auth)/login/page.tsx`
- Create: `lib/api-client.ts` (tiny fetch wrapper)
- Modify: `app/page.tsx` (landing with links)

**Interfaces:**
- Consumes: `/api/auth/*`.
- Produces: working browser flows that set the session cookie and redirect by role (`manager → /dashboard`, `user → /search`, `delivery → /dashboard`).

- [ ] **Step 1: Add the fetch helper**

`lib/api-client.ts`:
```ts
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
  return res.json();
}
```

- [ ] **Step 2: Build the signup page**

`app/(auth)/signup/page.tsx` — a client component (`"use client"`) with a form: name, email, password, `role` select (manager/user/delivery), city, and a conditional `vehicleType` field shown when role === "delivery". On submit call `apiPost("/api/auth/signup", form)` then `router.push` based on the returned `role`. Use Tailwind for basic layout; shadcn/ui `Input`/`Button`/`Select` if installed (`npx shadcn@latest add button input select` — run once, non-interactive).

- [ ] **Step 3: Build the login page**

`app/(auth)/login/page.tsx` — client component: email + password → `apiPost("/api/auth/login", form)` → redirect by role.

- [ ] **Step 4: Landing page links**

`app/page.tsx` — headline + "Sign up" / "Log in" links.

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```
In the browser: sign up as each of the three roles; confirm redirect and that a `session` cookie is set (DevTools → Application → Cookies). Log out via a POST to `/api/auth/logout` (add a temporary button) and log back in.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add signup and login pages"
```

---

## Task 13: User UI — search, business page, orders

**Files:**
- Create: `app/(user)/search/page.tsx`, `app/(user)/business/[id]/page.tsx`, `app/(user)/orders/page.tsx`

**Interfaces:**
- Consumes: `/api/search`, `/api/businesses/[id]`, `/api/orders`, `/api/bookings`, `/api/reviews`.

- [ ] **Step 1: Search page**

`app/(user)/search/page.tsx` — client component: inputs for query, city, type filter; on submit, read the browser geolocation (`navigator.geolocation.getCurrentPosition`, with a manual lat/lng fallback) and `GET /api/search?...`. Render each result: business name, offering name, price, rating, `distanceKm.toFixed(1)` km. Each row links to `/business/[id]`.

- [ ] **Step 2: Business page**

`app/(user)/business/[id]/page.tsx` — server component: fetch `/api/businesses/[id]`. List offerings. Products show an "Add to order" control (accumulate a simple cart in client state via a nested client component) and a "Place order" button → `POST /api/orders`. Services show a "Request booking" button (+ optional note) → `POST /api/bookings`.

- [ ] **Step 3: Orders page**

`app/(user)/orders/page.tsx` — client component: `GET /api/orders`, list orders with status; for `delivered` orders show a "Leave review" control → `POST /api/reviews`.

- [ ] **Step 4: Manual verification (the full loop, part 1)**

With dev server running and a manager + a product seeded (via the manager UI in Task 14, or a quick SQL insert): as a `user`, search → open business → place an order → see it in `/orders` as `pending`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add user search, business, and orders pages"
```

---

## Task 14: Manager & delivery UI

**Files:**
- Create: `app/(manager)/dashboard/page.tsx`, `app/(manager)/offerings/page.tsx`, `app/(delivery)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `/api/businesses`, `/api/offerings`, `/api/manager/orders`, `/api/orders/[id]`, `/api/bookings/[id]`, `/api/delivery/availability`, `/api/delivery/jobs`, `/api/orders/[id]/status`.

- [ ] **Step 1: Manager — business + offerings**

`app/(manager)/offerings/page.tsx` — client component: if the manager has no business, show a "Create business" form (`POST /api/businesses`). Then a form to add offerings (`POST /api/offerings`) with the product/service toggle (stock vs duration fields), and a list of existing offerings with delete (`DELETE /api/offerings/[id]`).

- [ ] **Step 2: Manager — orders & bookings**

`app/(manager)/dashboard/page.tsx` — client component: `GET /api/manager/orders`; each `pending` order shows an "Accept" button (`PATCH /api/orders/[id]`) that then displays the assigned partner (or "waiting for partner"). List booking requests with Accept/Decline (`PATCH /api/bookings/[id]`).

- [ ] **Step 3: Delivery — dashboard**

`app/(delivery)/dashboard/page.tsx` — client component: an availability toggle that sends current geolocation (`PATCH /api/delivery/availability`); a jobs list (`GET /api/delivery/jobs`) with "Mark picked up" / "Mark delivered" buttons (`PATCH /api/orders/[id]/status`).

- [ ] **Step 4: Manual verification (the full loop, end-to-end)**

Run through the whole thing in the browser:
1. Manager signs up → creates business → adds a product with stock.
2. Delivery partner signs up → toggles available (grants geolocation).
3. User signs up → searches their city → opens the business → places an order.
4. Manager accepts → sees a partner assigned; confirm product stock decreased.
5. Delivery partner sees the job → marks picked up → delivered; confirm they're available again.
6. User sees the order `delivered` → leaves a review; reload search and confirm the business rating changed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add manager and delivery dashboards"
```

---

## Task 15: Seed script & README

**Files:**
- Create: `scripts/seed.ts`
- Create/Modify: `README.md`

- [ ] **Step 1: Seed script**

`scripts/seed.ts` — inserts a couple of managers with businesses (products + services) in one city, a delivery partner (available), and a user. Run via `npx tsx scripts/seed.ts`. Add script `"db:seed": "tsx scripts/seed.ts"`.

- [ ] **Step 2: README**

Document: prerequisites (Node, Postgres), env setup (`.env`, `.env.test`), `npm run db:generate && db:migrate`, `db:seed`, `npm run dev`, `npm test`. Include the demo walkthrough from Task 14 Step 4.

- [ ] **Step 3: Verify from a clean state**

```bash
dropdb localcommerce || true && createdb localcommerce
npm run db:migrate && npm run db:seed && npm test
```
Expected: migrations apply, seed runs, full test suite passes.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add seed script and README"
```

---

## Self-Review Notes

- **Spec coverage:** roles (Task 3–4), businesses/offerings incl. both types (Task 5), city+vicinity+rating search (Task 6), product order→assign→deliver loop (Tasks 7–8, 11, 13–14), service booking request (Task 9, 11, 13–14), reviews + rating recompute (Task 10), auth + role guards (Task 4, enforced in Task 11), full REST surface (Task 11), UI for all three roles (Tasks 12–14). All spec §1–§8 items map to a task.
- **Deferred items** (payments, live tracking, smart assignment, scheduling, mobile, agent layer) are intentionally absent — matches spec §9.
- **Type consistency:** service signatures declared in each task's Interfaces block are reused verbatim by later tasks (`createOrder`, `acceptOrder`, `advanceOrderStatus`, `findNearestPartner`, `decrementStock`, `createReview`, `searchOfferings`).
- **Known executor watch-point:** unit-testing route handlers that call Next's `cookies()` (Task 4). The plan mocks the session module in Task 11 and asserts on the Response for Task 4; if `cookies()` misbehaves under Vitest, set the cookie header directly on the Response in the auth routes.
