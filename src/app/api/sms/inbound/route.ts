/** Twilio Messaging webhook: texts to the business line go to Caroline. */
import { formParams, validTwilioRequest } from "@/lib/telephony/twilio";
import { db, companyId, normalizePhone, type Message, type Lead, type Client } from "@/lib/db";
import { runAgent } from "@/lib/agents/runtime";
import twilio from "twilio";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const p = await formParams(req);
  if (!validTwilioRequest(req, p)) return new Response("invalid signature", { status: 403 });
  const cid = await companyId();
  const from = normalizePhone(p.From ?? "");
  const body = (p.Body ?? "").trim();
  const client = await db.findOne<Client>("clients", { company_id: cid, phone: from });
  const lead = await db.findOne<Lead>("leads", { company_id: cid, phone: from });
  await db.insert<Message>("messages", { company_id: cid, channel: "sms", direction: "inbound", from_address: from, to_address: normalizePhone(p.To ?? ""), body, client_id: client?.id ?? null, lead_id: lead?.id ?? null, provider_message_id: p.MessageSid });

  const history = (await db.list<Message>("messages", { company_id: cid, channel: "sms", from_address: from }, { limit: 10 })).reverse();
  const prior = history.slice(0, -1).map((m) => `${m.direction === "inbound" ? "Client" : "Caroline"}: ${m.body}`).join("\n");
  const result = await runAgent({
    agentId: "receptionist",
    message: `SMS conversation with ${from}${client ? ` (client: ${client.name})` : lead?.name ? ` (lead: ${lead.name})` : ""}.\n${prior ? `Earlier:\n${prior}\n\n` : ""}New text: "${body}"\n\nReply as an SMS (under 300 characters, plain text, no markdown). Use the tools to keep the lead current and propose a visit when you have enough. Return only the text to send.`,
    triggerSource: `sms:${p.MessageSid}`,
    leadId: lead?.id,
    clientId: client?.id,
    effort: "low",
  });
  const reply = result.text.split("HANDOFF TO:")[0].trim().slice(0, 600) || "Got it, thanks. Tyler will get back to you today.";
  await db.insert<Message>("messages", { company_id: cid, channel: "sms", direction: "outbound", from_address: normalizePhone(p.To ?? ""), to_address: from, body: reply, client_id: client?.id ?? null, lead_id: lead?.id ?? null, sent_by: "receptionist" });
  const r = new twilio.twiml.MessagingResponse();
  r.message(reply);
  return new Response(r.toString(), { headers: { "Content-Type": "text/xml" } });
}
