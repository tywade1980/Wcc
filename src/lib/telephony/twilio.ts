import twilio from "twilio";
import { env, hasTwilio } from "../env";

let rest: ReturnType<typeof twilio> | null = null;
export const twilioClient = () => (rest ??= twilio(env.twilioAccountSid, env.twilioAuthToken));

/** Validate X-Twilio-Signature for a form-encoded webhook. */
export function validTwilioRequest(req: Request, params: Record<string, string>): boolean {
  if (env.twilioSkipSignature || !env.twilioAuthToken) return env.twilioSkipSignature;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  // Twilio signs the public URL it called. Behind Vercel the request URL host may
  // be internal, so rebuild from the configured base URL plus path + query.
  const u = new URL(req.url);
  const publicUrl = `${env.baseUrl}${u.pathname}${u.search}`;
  return twilio.validateRequest(env.twilioAuthToken, sig, publicUrl, params);
}

export async function formParams(req: Request): Promise<Record<string, string>> {
  const fd = await req.formData();
  const out: Record<string, string> = {};
  fd.forEach((v, k) => (out[k] = String(v)));
  return out;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string } | { skipped: true }> {
  if (!hasTwilio() || !env.twilioPhoneNumber) return { skipped: true };
  const m = await twilioClient().messages.create({ to, from: env.twilioPhoneNumber, body });
  return { sid: m.sid };
}
