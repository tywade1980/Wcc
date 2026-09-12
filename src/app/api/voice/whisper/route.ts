/** Played to Tyler's phone before bridging; lets him screen the transfer. */
import { formParams, validTwilioRequest } from "@/lib/telephony/twilio";
import { whisperTwiml, xml } from "@/lib/telephony/twiml";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const text = new URL(req.url).searchParams.get("text") ?? "Incoming call from the office line.";
  return xml(whisperTwiml(text));
}
