/**
 * Office session: one passcode for a one-operator shop, signed cookie, checked
 * in middleware and in API routes. Swap for Supabase Auth when staff/clients
 * need their own logins (company_users table is ready for it).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const OFFICE_COOKIE = "wade_office";
const TTL_MS = 30 * 24 * 3600 * 1000;

export function signSession(): string {
  const exp = Date.now() + TTL_MS;
  const sig = createHmac("sha256", env.officeSessionSecret || "dev-secret").update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

export function verifySession(value: string | undefined | null): boolean {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", env.officeSessionSecret || "dev-secret").update(exp).digest("hex");
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function cookieValue(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${OFFICE_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** For API routes. Returns a 401 Response when not signed in, else null. */
export async function requireOffice(req: Request): Promise<Response | null> {
  if (!env.officePasscode) return null; // unconfigured preview: open (memory store, no secrets)
  return verifySession(cookieValue(req)) ? null : Response.json({ error: "sign in at /office/login" }, { status: 401 });
}

export function passcodeMatches(input: string): boolean {
  if (!env.officePasscode) return true;
  const a = Buffer.from(input), b = Buffer.from(env.officePasscode);
  return a.length === b.length && timingSafeEqual(a, b);
}
