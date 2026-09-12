/**
 * Caroline's phone brain. One structured Claude call per caller turn:
 * transcript in → { reply, extracted, action } out. The JSON contract is the
 * one proven in ai-receptionist-app/backend/receptionist.py; the persona is
 * the registry's receptionist prompt.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env, hasAnthropic } from "../env";
import { db, companyId, normalizePhone, type Call, type CallTurn, type Lead, type Client, type Appointment, type AgentAction } from "../db";
import { AGENTS } from "../agents/registry";
import { routeIntent, isWithinHours, type CallerIntent } from "./routing";

export const TurnSchema = z.object({
  reply: z.string().describe("What Caroline says out loud next. One or two short sentences."),
  intent: z.enum(["new_lead", "existing_client", "vendor", "spam", "personal", "billing", "warranty", "emergency", "other"]),
  extracted: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    job_type: z.string().nullable(),
    address: z.string().nullable(),
    preferred_time: z.string().nullable(),
    budget_range: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  action: z.enum(["continue", "book", "transfer", "voicemail", "end"]),
  summary: z.string().describe("One line for the call log."),
});
export type Turn = z.infer<typeof TurnSchema>;

let anthropic: Anthropic | null = null;
const client = () => (anthropic ??= new Anthropic({ apiKey: env.anthropicApiKey }));

const VOICE_RULES = `
YOU ARE ON A LIVE PHONE CALL. Respond with the JSON object only.
- "reply" is spoken by text-to-speech: plain words, no markdown, no lists, no emojis, spell nothing.
- One or two short sentences per turn. Ask one question at a time.
- "action": continue while gathering; book when you have name + phone + job type + (address OR preferred time) and have confirmed them back; transfer when the caller needs Tyler now (existing client with an active job, urgent site issue, or an insistent request); voicemail when they ask to leave a message or it is after hours and they need Tyler; end for spam or after a booking is confirmed and goodbyes are done.
- On "book" and "end", the reply must include the goodbye.
- Fill "extracted" with everything learned so far across the whole call, null when unknown. Use the caller ID as phone unless they give another.
- Never make up availability or prices.
`;

export async function startCall(params: { callSid: string; from: string; to: string; callerName?: string }): Promise<{ call: Call; greeting: string; client: Client | null }> {
  const cid = await companyId();
  const from = normalizePhone(params.from);
  const known = await db.findOne<Client>("clients", { company_id: cid, phone: from });
  const lead = known ? null : await db.findOne<Lead>("leads", { company_id: cid, phone: from });
  const call = await db.insert<Call>("calls", { company_id: cid, provider: "twilio", provider_call_id: params.callSid, direction: "inbound", from_number: from, to_number: normalizePhone(params.to), caller_name: known?.name ?? lead?.name ?? params.callerName ?? null, client_id: known?.id ?? null, lead_id: lead?.id ?? null, status: "in_progress", handled_by: "receptionist", extracted: {}, started_at: new Date().toISOString() });
  const who = known?.name ? `, ${known.name.split(" ")[0]}` : "";
  const greeting = known
    ? `Thanks for calling ${env.companyName}, this is Caroline. Good to hear from you${who}. How can I help today?`
    : `Thanks for calling ${env.companyName}, this is Caroline in Tyler's office. How can I help you today?`;
  await db.insert<CallTurn>("call_turns", { call_id: call.id, seq: 0, speaker: "caroline", text: greeting });
  return { call, greeting, client: known };
}

export async function nextTurn(callId: string, callerText: string, confidence?: number): Promise<{ turn: Turn; call: Call; ownerNumber: string }> {
  const call = await db.get<Call>("calls", callId);
  if (!call) throw new Error("call not found");
  const turns = await db.list<CallTurn>("call_turns", { call_id: callId }, { orderBy: "seq", asc: true });
  const seq = turns.length;
  await db.insert<CallTurn>("call_turns", { call_id: callId, seq, speaker: "caller", text: callerText, confidence: confidence ?? null });

  const withinHours = isWithinHours(new Date(), env.timezone);
  const transcript = [...turns, { speaker: "caller", text: callerText }].map((t) => `${t.speaker === "caller" ? "Caller" : "Caroline"}: ${t.text}`).join("\n");
  const context = `Caller ID: ${call.from_number ?? "unknown"}${call.caller_name ? ` (${call.caller_name})` : ""}. Known client: ${call.client_id ? "yes" : "no"}. Within business hours: ${withinHours ? "yes" : "no"}. Owner mobile on file: ${env.ownerMobile ? "yes" : "no"}.\n\nTranscript so far:\n${transcript}`;

  let turn: Turn;
  if (!hasAnthropic()) {
    turn = { reply: "Thanks. Our office system is being set up right now, so please text or call Tyler directly and he'll get right back to you.", intent: "other", extracted: { name: null, phone: call.from_number ?? null, job_type: null, address: null, preferred_time: null, budget_range: null, notes: callerText }, action: "end", summary: "Model not configured; caller directed to text Tyler." };
  } else {
    const res = await client().messages.parse({
      model: env.receptionistModel,
      max_tokens: 1200,
      system: [{ type: "text", text: AGENTS.receptionist.system + VOICE_RULES, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: zodOutputFormat(TurnSchema) },
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      turn = { reply: "Let me take a message and have Tyler call you back. What's the best number for you?", intent: "other", extracted: { name: null, phone: call.from_number ?? null, job_type: null, address: null, preferred_time: null, budget_range: null, notes: null }, action: "continue", summary: "Model declined; fell back to message-taking." };
    } else turn = res.parsed_output;
  }

  // Routing policy can override the model's action (e.g. after hours → voicemail instead of transfer).
  const policy = routeIntent(turn.intent as CallerIntent, { knownClient: Boolean(call.client_id), withinHours, ownerAvailable: Boolean(env.ownerMobile) });
  if (turn.action === "transfer" && (policy.action === "voicemail" || !env.ownerMobile)) turn.action = "voicemail";
  if (turn.intent === "spam" && turn.action === "continue") turn.action = "end";

  await db.insert<CallTurn>("call_turns", { call_id: callId, seq: seq + 1, speaker: "caroline", text: turn.reply });
  const extracted = { ...(call.extracted ?? {}), ...Object.fromEntries(Object.entries(turn.extracted).filter(([, v]) => v)) };
  const updated = await db.update<Call>("calls", callId, { intent: turn.intent, summary: turn.summary, extracted, caller_name: (extracted.name as string) ?? call.caller_name ?? null, status: turn.action === "transfer" ? "transferred" : turn.action === "voicemail" ? "voicemail" : call.status });
  await syncLeadFromCall(updated, turn);
  return { turn, call: updated, ownerNumber: env.ownerMobile };
}

/** Keep the lead record current as the call progresses; create it on first real signal. */
async function syncLeadFromCall(call: Call, turn: Turn) {
  const cid = await companyId();
  const x = call.extracted as Record<string, string | null>;
  const isLead = turn.intent === "new_lead" || (turn.intent === "other" && (x.job_type || x.name));
  if (!isLead && !call.lead_id) return;
  const fields: Partial<Lead> = { name: x.name ?? undefined, phone: x.phone ? normalizePhone(x.phone) : call.from_number ?? undefined, address: x.address ?? undefined, project_type: x.job_type ?? undefined, description: x.notes ?? undefined, budget_range: x.budget_range ?? undefined, timeline: x.preferred_time ?? undefined };
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<Lead>;
  let leadId = call.lead_id ?? null;
  if (leadId) await db.update<Lead>("leads", leadId, clean);
  else {
    const lead = await db.insert<Lead>("leads", { company_id: cid, source: "phone", stage: "connected", owner_agent: "receptionist", ...clean } as Partial<Lead>);
    leadId = lead.id;
    await db.update<Call>("calls", call.id, { lead_id: leadId });
  }
  if (turn.action === "book" && x.preferred_time) {
    const dup = await db.findOne<Appointment>("appointments", { lead_id: leadId, status: "proposed" });
    if (!dup) {
      await db.insert<Appointment>("appointments", { company_id: cid, kind: "site_visit", title: `Site visit — ${x.name ?? call.from_number} (${x.job_type ?? "project"})`, proposed_windows: [x.preferred_time], location: x.address ?? null, status: "proposed", lead_id: leadId, client_id: call.client_id ?? null, created_by: "receptionist" });
      await db.update<Lead>("leads", leadId, { stage: "meeting_scheduled", next_task: `Confirm site visit: ${x.preferred_time}` });
    }
  }
  await db.insert<AgentAction>("agent_actions", { company_id: cid, agent_id: "receptionist", action: turn.action === "book" ? "book_from_call" : "update_lead_from_call", input: { call_id: call.id, extracted: x } as never, output: { lead_id: leadId } as never, status: "done", trigger_source: `call:${call.provider_call_id}`, entity_type: "lead", entity_id: leadId ?? undefined });
}

export async function finishCall(callId: string, patch: Partial<Call>) {
  const call = await db.get<Call>("calls", callId);
  if (!call) return null;
  return db.update<Call>("calls", callId, { ended_at: new Date().toISOString(), ...patch });
}

/** After-call SMS to the owner with the one-line summary and a link. */
export function ownerSummarySms(call: Call): string {
  const x = call.extracted as Record<string, string | null>;
  const who = x.name ?? call.caller_name ?? call.from_number ?? "Unknown caller";
  const bits = [x.job_type, x.address, x.preferred_time].filter(Boolean).join(" · ");
  return `Caroline: ${call.status === "voicemail" ? "Voicemail" : call.outcome === "booked" || call.status === "completed" ? "Call" : "Call"} from ${who}${bits ? ` — ${bits}` : ""}. ${call.summary ?? ""} ${env.baseUrl}/office/inbox/${call.id}`.trim();
}
