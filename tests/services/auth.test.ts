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
