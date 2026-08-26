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

test("malformed signup body returns 400", async () => {
  const res = await signup(req({ email: "not-an-email" }));
  expect(res.status).toBe(400);
});
