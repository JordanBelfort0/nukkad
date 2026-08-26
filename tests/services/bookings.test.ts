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
  await expect(createBooking(usr.id, { offeringId: off.id })).rejects.toMatchObject({ status: 400 });
});

test("createBooking with unknown offeringId throws 404", async () => {
  const { usr } = await seed("service");
  await expect(createBooking(usr.id, { offeringId: "00000000-0000-0000-0000-000000000000" })).rejects.toMatchObject({ status: 404 });
});

test("respondToBooking by non-owning manager throws 403", async () => {
  const { usr, off } = await seed("service");
  const [mgr2] = await db.insert(users).values({ name: "M2", email: "m2@e.com", passwordHash: "x", role: "manager", city: "Jaipur" }).returning();
  const b = await createBooking(usr.id, { offeringId: off.id });
  await expect(respondToBooking(mgr2.id, b.id, "accepted")).rejects.toMatchObject({ status: 403 });
});

test("respondToBooking on already-handled booking throws 409", async () => {
  const { mgr, usr, off } = await seed("service");
  const b = await createBooking(usr.id, { offeringId: off.id });
  await respondToBooking(mgr.id, b.id, "accepted");
  await expect(respondToBooking(mgr.id, b.id, "declined")).rejects.toMatchObject({ status: 409 });
});
