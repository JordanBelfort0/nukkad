# Local Commerce Platform — Design Spec (First Slice)

**Date:** 2026-08-26
**Status:** Approved design — pending implementation plan
**Author:** Nisha Kumari

---

## 1. Overview

A city-scoped local commerce + logistics marketplace. Businesses, retailers, and
service providers in a city list themselves and their offerings. Users search for a
product or service within their city, see providers ranked by rating and vicinity,
and — for physical products — get the item delivered by an assigned delivery partner
(store → user). The differentiator is **quick commerce for niche & local products and
services** that big platforms don't carry.

This spec covers the **first slice** only. The larger vision (payments, live tracking,
smart batching, service scheduling, mobile app, AI/agent layer) is explicitly deferred
to later slices, each of which gets its own spec → plan → build cycle.

### Goals of this slice
- Prove the wedge: discover a local provider and get a product delivered, end-to-end.
- Support **both** products and services on the *listing* side.
- Fully build the **product order → delivery** loop (simple/manual, no payment/tracking).
- Provide a **service booking request** (light path, no scheduling).
- Ship a full-stack **Node.js (Next.js)** web app on **Postgres**.

### Non-goals (deferred)
- In-app payments (cash / settle-later for now).
- Live GPS tracking / realtime updates.
- Smart assignment (batching, ETAs) — nearest-available only.
- Service scheduling / calendars.
- Cross-business carts.
- Mobile app.
- AI / agent layer (natural-language search, catalog-building assistant).

---

## 2. Roles

- **Manager** — owns a business; manages its offerings; accepts orders and booking requests.
- **User** — searches, orders products, requests service bookings, leaves reviews.
- **Delivery partner** — toggles availability; receives assignments; marks pickup/delivery.

---

## 3. Architecture & stack

**Approach:** Single full-stack **Next.js (App Router)** app on Node.js — web UI + JSON
API route handlers in one deployable. Business logic lives in a **service layer**
(`lib/services/`) so the future mobile app and agent layer can reuse it.

- **Framework:** Next.js (App Router), Node.js runtime.
- **Database:** Postgres — Neon (Vercel Marketplace) for deploy, local Postgres for dev.
- **ORM:** Drizzle + drizzle-kit (typed schema & migrations; easy raw-SQL escape hatch
  for the geo-ranking query).
- **Validation:** Zod on all inputs.
- **UI:** Tailwind CSS + shadcn/ui.
- **Auth:** email/password, bcrypt hash, signed **JWT in an httpOnly cookie**;
  `requireRole()` guards on protected routes. Swappable for Clerk later.
- **Testing:** Vitest against a real test Postgres.

### Project structure
```
app/
  (auth)/…                 sign-up / login for all 3 roles
  (user)/search, /business/[id], /orders     user-facing
  (manager)/dashboard, /offerings, /orders   manager-facing
  (delivery)/dashboard                       partner-facing
  api/…                    REST route handlers (thin — call services)
lib/
  db/        drizzle schema + client + migrations
  services/  catalog · search · orders · assignment · reviews  ← real logic, unit-tested
  auth/      session, hashing, role guards
```
Route handlers stay thin and delegate to `lib/services/*`.

---

## 4. Data model

### Identity & roles
- **`users`** — `id, name, email, phone, password_hash, role ('manager'|'user'|'delivery'), city, created_at`
- **`delivery_profiles`** — `user_id → users, vehicle_type, is_available, current_lat, current_lng, rating`

### Supply side
- **`businesses`** — `id, manager_id → users, name, description, category, city, address, lat, lng, rating (avg, derived), is_active, created_at`
- **`offerings`** — `id, business_id → businesses, type ('product'|'service'), name, description, price, stock (products, nullable), duration_minutes (services, nullable), is_available, image_url`

### Demand side
- **`orders`** (products) — `id, user_id → users, business_id → businesses, delivery_partner_id (nullable → users), status, delivery_address, delivery_lat, delivery_lng, total_amount, created_at`
  - `status`: `pending → accepted → assigned → picked_up → delivered`, plus `cancelled`.
- **`order_items`** — `id, order_id → orders, offering_id → offerings, quantity, unit_price`
  - One order = one business; may contain multiple products from that business.
- **`booking_requests`** (services) — `id, user_id → users, business_id → businesses, offering_id → offerings, status ('requested'|'accepted'|'declined'|'completed'), note, created_at`

### Trust
- **`reviews`** — `id, user_id → users, business_id → businesses, order_id (nullable → orders), rating (1–5), comment, created_at`
  - `businesses.rating` is the average of its reviews, recomputed on each new review.

### Design calls
- **Vicinity** = lat/lng on `businesses` + a Postgres **haversine** distance expression
  in the search query. No PostGIS yet; upgradeable later.
- **One business per order** — keeps delivery assignment to a single pickup.
- **Ratings derived, not manually set** — computed from `reviews`.

---

## 5. Core flows

### 5.1 Onboarding
Sign-up selects a role.
- **Manager** → creates a business (name, category, city, address, lat/lng).
- **User** → provides city + delivery location.
- **Delivery partner** → creates a `delivery_profile` (vehicle; `is_available=false` initially).

### 5.2 Manager builds catalog
Manager adds **offerings** in the dashboard, picking type (product/service). Products
have stock; services have duration. Offerings appear on the business's public page and
in search.

### 5.3 User discovery (heart of the product)
User searches a query within their **city**, with optional `type` (product/service) and
`category` filters. Results are ranked by a **blend of rating and distance** (haversine
from the user's location). A business page shows its full catalog.

### 5.4a Product → order → delivery (full loop)
1. User adds product(s) from **one** business to a cart → places order (`pending`).
   Payment skipped.
2. Manager **accepts** (`accepted`); stock decremented.
3. **Assignment (automatic, on accept):** system selects the **nearest available**
   delivery partner in that city (`is_available=true`, ordered by distance to the
   business) → order `assigned`; partner marked busy.
4. Partner **marks picked up** (`picked_up`) → **marks delivered** (`delivered`);
   partner marked available again.
5. User can leave a **review**.

**No partner available:** order stays `accepted` and remains assignable until a partner
frees up (retry / manual assign).

### 5.4b Service → booking request (light path)
1. User hits "Request booking" on a service offering with an optional note →
   `booking_request` (`requested`).
2. Manager **accepts** or **declines**. No scheduling, no courier.

### 5.5 Ratings
After a delivered order (or completed booking), the user rates the business;
`businesses.rating` recomputes.

### 5.6 Error / edge handling (minimal but real)
- No available partner → order waits as `accepted`.
- Out-of-stock → offering hidden / order rejected.
- Only the owning manager may modify their business/offerings.
- Users cannot order from their own business.
- Role guards on every mutating route.

---

## 6. API surface

Thin route handlers → `lib/services/*`.

### Auth
- `POST /api/auth/signup` (role + fields)
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Public / user
- `GET /api/search?q=&city=&type=&category=&lat=&lng=` → ranked offerings
- `GET /api/businesses/:id` → business + offerings
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`
- `POST /api/bookings`, `GET /api/bookings`
- `POST /api/reviews`

### Manager
- `POST /api/businesses` (create/update own)
- `POST /api/offerings`, `PATCH /api/offerings/:id`, `DELETE /api/offerings/:id`
- `GET /api/manager/orders`, `PATCH /api/orders/:id` (accept → triggers assignment)
- `PATCH /api/bookings/:id` (accept/decline)

### Delivery
- `PATCH /api/delivery/availability` (toggle + update location)
- `GET /api/delivery/jobs` (assigned to me)
- `PATCH /api/orders/:id/status` (picked_up → delivered)

---

## 7. Service layer (`lib/services/`)

- **`catalog`** — CRUD offerings, stock management.
- **`search`** — ranking query (city filter + haversine distance + rating blend).
- **`orders`** — create, accept, state transitions, stock decrement.
- **`assignment`** — nearest-available-partner selection.
- **`reviews`** — insert + recompute business rating.

---

## 8. Testing (Vitest, against a real test Postgres)

- **Search ranking:** nearer / higher-rated ranks first; city filter excludes others.
- **Order state machine:** only legal transitions; cannot deliver an unaccepted order.
- **Assignment:** picks nearest available; no partner → order stays `accepted`.
- **Reviews:** rating average recomputes correctly.
- **Auth guards:** wrong role → 403.

A real test Postgres (Docker/local) is used so the geo query is genuinely exercised.

---

## 9. Future slices (out of scope here)

1. Payments (Stripe) at checkout.
2. Live delivery tracking (websockets).
3. Smart assignment — batching, ETAs.
4. Service scheduling / calendars.
5. Mobile app (reuses this API).
6. AI / agent layer — natural-language search, catalog-building assistant.
