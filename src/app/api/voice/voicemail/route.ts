/** Recording + transcription callbacks for voicemail. */
import { formParams, validTwilioRequest, sendSms } from "@/lib/telephony/twilio";
import { goodbyeTwiml, xml } from "@/lib/telephony/twiml";
import { finishCall, ownerSummarySms } from "@/lib/telephony/receptionist";
import { db, type Call } from "@/lib/db";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const u = new URL(req.url);
  const callId = u.searchParams.get("call") ?? "";
  if (u.searchParams.get("transcription")) {
    const call = await db.update<Call>("calls", callId, { voicemail_transcript: p.TranscriptionText ?? "", summary: p.TranscriptionText ? `Voicemail: ${p.TranscriptionText.slice(0, 140)}` : undefined });
    if (env.ownerMobile) sendSms(env.ownerMobile, ownerSummarySms(call)).catch(() => {});
    return new Response(null, { status: 204 });
  }
  await finishCall(callId, { status: "voicemail", outcome: "message_taken", recording_url: p.RecordingUrl ? `${p.RecordingUrl}.mp3` : null, duration_seconds: p.RecordingDuration ? Number(p.RecordingDuration) : null });
  return xml(goodbyeTwiml("Thank you. We'll be in touch soon. Goodbye."));
}
