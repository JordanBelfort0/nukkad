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
