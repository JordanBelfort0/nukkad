import { expect, test } from "vitest";
import { sql } from "@/lib/db/client";

test("database connection works", async () => {
  const rows = await sql`select 1 as ok`;
  expect(rows[0].ok).toBe(1);
});
