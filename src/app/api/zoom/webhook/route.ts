/**
 * Zoom event subscription endpoint. Subscribe (in the Zoom S2S app) to:
 *   phone.callee_missed, phone.callee_answered, phone.callee_ended,
 *   phone.voicemail_received, phone.recording_completed,
 *   meeting.started, meeting.ended, recording.completed
 * Endpoint URL: {BASE}/api/zoom/webhook
 */
import { verifyZoomSignature, urlValidationResponse, ingestZoomPhoneEvent } from "@/lib/integrations/zoom";
import { db, companyId } from "@/lib/db";
import { sendSms } from "@/lib/telephony/twilio";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const evt = JSON.parse(raw) as { event: string; event_ts: number; payload: { plainToken?: string; account_id: string; object: Record<string, unknown> } };
  if (evt.event === "endpoint.url_validation" && evt.payload.plainToken) return Response.json(urlValidationResponse(evt.payload.plainToken));
  if (!verifyZoomSignature(req.headers, raw)) return new Response("invalid signature", { status: 401 });

  if (evt.event.startsWith("phone.")) {
    const call = await ingestZoomPhoneEvent(evt as never);
    if (call && (call.status === "missed" || call.status === "voicemail") && call.from_number && env.twilioPhoneNumber) {
      sendSms(call.from_number, `Hi, this is Caroline at ${env.companyName}. Sorry we missed your call. Text me what you're working on and I'll get Tyler back to you today.`).catch(() => {});
    }
    return new Response(null, { status: 204 });
  }
  const cid = await companyId();
  await db.insert("integration_events", { company_id: cid, provider: "zoom", event_type: evt.event, provider_event_id: String((evt.payload.object as { uuid?: string; id?: string }).uuid ?? (evt.payload.object as { id?: string }).id ?? evt.event_ts), payload: evt as never, processed: false } as never);
  return new Response(null, { status: 204 });
}
