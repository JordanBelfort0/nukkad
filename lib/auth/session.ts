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
