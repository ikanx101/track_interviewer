import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "iman_admin";
export const SESSION_HOURS = 12;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "iman-dev-secret-change-me";
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "ADMIN_FIELD" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "ADMIN_FIELD";
  } catch {
    return false;
  }
}

/** Bandingkan password tanpa membocorkan panjang lewat timing kasar. */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "admin";
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i++) diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
