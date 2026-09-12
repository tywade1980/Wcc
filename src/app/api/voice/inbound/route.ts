/**
 * Twilio Voice webhook: the business line rings here. Caroline answers.
 * Configure the Twilio number → Voice → "A call comes in" → POST {BASE}/api/voice/inbound
 * and Status callback → POST {BASE}/api/voice/status
 */
import { formParams, validTwilioRequest } from "@/lib/telephony/twilio";
import { greetingTwiml, rejectTwiml, voicemailTwiml, xml } from "@/lib/telephony/twiml";
import { startCall } from "@/lib/telephony/receptionist";
import { screenNumber } from "@/lib/telephony/routing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const { call, greeting } = await startCall({ callSid: p.CallSid, from: p.From ?? "", to: p.To ?? "", callerName: p.CallerName });
  const screen = screenNumber(p.From ?? "");
  if (screen?.action === "end") return xml(rejectTwiml());
  if (screen?.action === "voicemail") return xml(voicemailTwiml(call.id, `Thanks for calling. Please leave a message after the tone.`));
  return xml(greetingTwiml(call.id, greeting));
}
