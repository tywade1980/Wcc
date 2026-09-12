/** One caller turn: Twilio posts SpeechResult; Caroline replies and decides the next step. */
import { formParams, validTwilioRequest, sendSms } from "@/lib/telephony/twilio";
import { replyAndListenTwiml, repromptTwiml, transferTwiml, voicemailTwiml, goodbyeTwiml, xml } from "@/lib/telephony/twiml";
import { nextTurn, finishCall, ownerSummarySms } from "@/lib/telephony/receptionist";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const callId = new URL(req.url).searchParams.get("call") ?? "";
  const speech = (p.SpeechResult ?? "").trim();
  const confidence = p.Confidence ? Number(p.Confidence) : undefined;
  if (!speech || (confidence !== undefined && confidence < 0.3)) return xml(repromptTwiml(callId));

  const { turn, call, ownerNumber } = await nextTurn(callId, speech, confidence);
  switch (turn.action) {
    case "transfer": {
      const x = call.extracted as Record<string, string | null>;
      const whisper = `Caroline here. ${x.name ?? call.caller_name ?? "A caller"}${x.job_type ? `, about ${x.job_type}` : ""}.`;
      return xml(transferTwiml(callId, turn.reply, ownerNumber, whisper));
    }
    case "voicemail":
      return xml(voicemailTwiml(callId, turn.reply));
    case "book":
    case "end": {
      const done = await finishCall(callId, { status: "completed", outcome: turn.action === "book" ? "booked" : call.intent === "spam" ? "spam" : "info" });
      if (done && env.ownerMobile && turn.action === "book") sendSms(env.ownerMobile, ownerSummarySms(done)).catch(() => {});
      return xml(goodbyeTwiml(turn.reply));
    }
    default:
      return xml(replyAndListenTwiml(callId, turn.reply));
  }
}
