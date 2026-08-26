import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { HttpError } from "@/lib/http";

export type Role = "manager" | "user" | "delivery";
export interface SessionPayload { userId: string; role: Role }

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
};

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

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7d

/** Returns a Set-Cookie header value that writes the session token. */
export function buildSessionCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

/** Returns a Set-Cookie header value that clears the session cookie. */
export function expiredSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Reads the session from the incoming request cookie (server-component / route context only). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifySession(token) : null;
}

/** Asserts the caller has one of the given roles; throws HttpError otherwise. */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Not authenticated");
  if (!roles.includes(s.role)) throw new HttpError(403, "Forbidden");
  return s;
}
