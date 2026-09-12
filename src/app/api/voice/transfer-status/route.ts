/** After <Dial> to the owner ends: either the bridge completed or it fell through to voicemail. */
import { formParams, validTwilioRequest, sendSms } from "@/lib/telephony/twilio";
import { voicemailTwiml, goodbyeTwiml, xml } from "@/lib/telephony/twiml";
import { finishCall, ownerSummarySms } from "@/lib/telephony/receptionist";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const callId = new URL(req.url).searchParams.get("call") ?? "";
  const status = p.DialCallStatus ?? "";
  if (status === "completed") {
    await finishCall(callId, { status: "completed", handled_by: "owner", outcome: "transferred", duration_seconds: p.DialCallDuration ? Number(p.DialCallDuration) : null });
    return xml(goodbyeTwiml("Thanks for calling. Goodbye."));
  }
  const call = await finishCall(callId, { status: "voicemail", outcome: "message_taken" });
  if (call && env.ownerMobile) sendSms(env.ownerMobile, `Missed transfer. ${ownerSummarySms(call)}`).catch(() => {});
  return xml(voicemailTwiml(callId, "Tyler is on a job site right now. Leave your name, number, and what you need, and he'll call you back today."));
}
