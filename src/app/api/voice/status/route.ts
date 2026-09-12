/** Twilio status callback: final call state, duration, missed calls → text-back. */
import { formParams, validTwilioRequest, sendSms } from "@/lib/telephony/twilio";
import { db, type Call } from "@/lib/db";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const call = await db.findOne<Call>("calls", { provider_call_id: p.CallSid });
  if (!call) return new Response(null, { status: 204 });
  const status = p.CallStatus;
  const patch: Partial<Call> = { duration_seconds: p.CallDuration ? Number(p.CallDuration) : call.duration_seconds ?? null };
  if (["completed", "busy", "no-answer", "failed", "canceled"].includes(status)) {
    patch.ended_at = call.ended_at ?? new Date().toISOString();
    if (call.status === "in_progress") patch.status = status === "completed" ? "completed" : "missed";
  }
  await db.update<Call>("calls", call.id, patch);
  // Missed-call text-back: caller hung up before Caroline finished.
  if (patch.status === "missed" && call.from_number && env.twilioPhoneNumber) {
    sendSms(call.from_number, `Hi, this is Caroline at ${env.companyName}. Sorry we missed you. Text me what you're working on and I'll get Tyler back to you today.`).catch(() => {});
  }
  return new Response(null, { status: 204 });
}
