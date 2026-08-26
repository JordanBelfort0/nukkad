# Local Commerce Platform

A full-stack local commerce platform built with Next.js 16, Drizzle ORM, and Neon Postgres. It connects three types of users — **managers** who run local businesses, **customers** who browse, order, and book services, and **delivery partners** who fulfill product orders. Managers create businesses and list product or service offerings; customers search by city and location, place orders or book appointments, and leave reviews; delivery partners toggle availability, pick up assigned orders, and mark them delivered. The platform handles the full order lifecycle from placement through acceptance, assignment, pickup, and delivery.

---

## Prerequisites

- **Node.js** 24 or later (tested on 25.x)
- A **Neon** (or any Postgres) database with two connection strings:
  - `DATABASE_URL` — pooled connection (pgbouncer) for the application
  - `DATABASE_URL_UNPOOLED` — direct connection for migrations

---

## Environment setup

Create a `.env` file in the project root for the development database:

```
DATABASE_URL=postgres://...        # pooled endpoint
DATABASE_URL_UNPOOLED=postgres://... # direct endpoint
JWT_SECRET=your-secret-here
```

Create a `.env.test` file for the isolated test database (database name must end in `_test`):

```
DATABASE_URL=postgres://.../neondb_test
DATABASE_URL_UNPOOLED=postgres://.../neondb_test
JWT_SECRET=test-secret
```

If you are deploying to Vercel you can pull both files automatically:

```bash
vercel env pull .env
```

Both files are git-ignored and must not be committed.

---

## Commands

```bash
# Install dependencies
npm install

# Generate and apply database migrations (dev DB)
npm run db:generate
npm run db:migrate

# Apply migrations to the test DB
npm run db:migrate:test

# Seed the dev DB with demo data (truncates existing data — see warning below)
npm run db:seed

# Start the development server at http://localhost:3000
npm run dev

# Run the full test suite
npm test
```

> **WARNING — db:seed wipes dev data.** The seed script truncates all application tables before inserting. Do not run it if you have data you want to keep.

---

## Roles

| Role | What they can do |
|------|-----------------|
| **manager** | Sign up, create one business, add product or service offerings, view and accept incoming orders and booking requests, manage offering inventory |
| **user** | Sign up, search businesses by city / keyword / location, add items to cart, place product orders, request service bookings, track order status, leave reviews |
| **delivery** | Sign up, toggle availability, view assigned jobs, advance order status (picked up → delivered) |

---

## REST API surface

All routes are prefixed `/api`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create an account (manager / user / delivery) |
| POST | `/api/auth/login` | Authenticate and receive a session cookie |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/auth/me` | Return the current authenticated user |

### Businesses
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/businesses` | List all active businesses |
| GET | `/api/businesses/:id` | Get a single business with its offerings |

### Manager (authenticated, manager role)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/manager/business` | Create the manager's business |
| GET | `/api/manager/orders` | List all orders for the manager's business |

### Offerings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/offerings` | List offerings (filter by `?businessId=`) |
| POST | `/api/offerings` | Create an offering (manager only) |
| PATCH | `/api/offerings/:id` | Update an offering (manager only) |
| DELETE | `/api/offerings/:id` | Delete an offering (manager only) |

### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search` | Search offerings by `?city=`, `?q=`, `?lat=`, `?lng=`, `?radius=` |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | Place a product order (user only) |
| GET | `/api/orders/:id` | Get order details |
| PATCH | `/api/orders/:id` | Accept an order / cancel (manager or admin) |
| PATCH | `/api/orders/:id/status` | Advance order status (delivery partner) |

### Bookings
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bookings` | Request a service booking (user only) |
| GET | `/api/bookings/:id` | Get booking details |
| PATCH | `/api/bookings/:id` | Accept / decline a booking (manager only) |

### Delivery
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/delivery/availability` | Toggle availability (delivery partner) |
| GET | `/api/delivery/jobs` | List jobs assigned to the current delivery partner |

### Reviews
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reviews` | Submit a review for a delivered order (user only) |

---

## Demo walkthrough

This walkthrough shows the end-to-end flow using the seeded accounts. Start the dev server (`npm run dev`) and open `http://localhost:3000`.

1. **Manager creates a business and adds a product**
   - Log in as `priya.manager@example.com` (password: `password123`)
   - The manager dashboard shows the existing business and its product offerings
   - Add a new offering via the Offerings page

2. **Delivery partner goes available**
   - Log in as `ravi.delivery@example.com`
   - Toggle availability to "Available" from the delivery dashboard

3. **User searches and places an order**
   - Log in as `sneha.user@example.com`
   - Go to Search, type "Jaipur" or search near the city
   - Open "Priya's Fresh Mart" and add products to the cart
   - Place the order with a delivery address

4. **Manager accepts the order**
   - Switch back to `priya.manager@example.com`
   - The new order appears in the manager dashboard with status "pending"
   - Click Accept — the platform assigns the nearest available delivery partner (Ravi)

5. **Delivery partner picks up and delivers**
   - Switch to `ravi.delivery@example.com`
   - The accepted order appears in the Jobs list
   - Advance status to "picked_up", then "delivered"

6. **User leaves a review**
   - Switch to `sneha.user@example.com`
   - Open the completed order and submit a star rating and comment
   - The business rating updates automatically

7. **Service booking flow**
   - Log in as `sneha.user@example.com`, find "Arjun's Style Studio"
   - Request a booking for "Haircut & Styling"
   - Log in as `arjun.manager@example.com` and accept the booking request from the dashboard

---

## Project structure

```
app/
  (auth)/         Login and signup pages
  (manager)/      Manager dashboard and offerings management
  (user)/         Search, business detail, orders, booking pages
  (delivery)/     Delivery partner dashboard and job list
  api/            Next.js route handlers (REST API)
lib/
  auth/           JWT session helpers, password hashing
  db/             Drizzle client and schema
  services/       Business logic (orders, offerings, search, reviews, …)
scripts/
  seed.ts         Dev database seed script
tests/            Vitest unit and integration tests
drizzle/          Generated SQL migrations
```

---

## Running tests

```bash
# Make sure .env.test points to a separate Postgres database ending in _test
npm run db:migrate:test
npm test
```

Tests run against `neondb_test` and are fully isolated — each test resets the database before running.
