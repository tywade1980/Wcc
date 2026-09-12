/** Tyler approves or rejects an agent's client-facing action from his phone. */
import { db, companyId, type Approval, type Message, type AgentAction } from "@/lib/db";
import { sendSms } from "@/lib/telephony/twilio";
import { requireOffice } from "@/lib/office-auth";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOffice(req);
  if (denied) return denied;
  const { id } = await params;
  const { decision, edited_body } = (await req.json()) as { decision: "approved" | "rejected"; edited_body?: string };
  const approval = await db.get<Approval>("approvals", id);
  if (!approval || approval.status !== "pending") return Response.json({ error: "not pending" }, { status: 400 });
  const cid = await companyId();
  const updated = await db.update<Approval>("approvals", id, { status: decision, decided_by: "tyler", decided_at: new Date().toISOString() });
  if (approval.agent_action_id) await db.update<AgentAction>("agent_actions", approval.agent_action_id, { status: decision === "approved" ? "done" : "rejected" });

  let sent: unknown = null;
  if (decision === "approved" && approval.kind === "send_message") {
    const p = approval.payload as { channel: string; to: string; body: string; lead_id?: string | null; client_id?: string | null };
    const body = edited_body ?? p.body;
    if (p.channel === "sms") sent = await sendSms(p.to, body);
    await db.insert<Message>("messages", { company_id: cid, channel: p.channel === "sms" ? "sms" : "email", direction: "outbound", to_address: p.to, body, lead_id: p.lead_id ?? null, client_id: p.client_id ?? null, sent_by: "tyler", approval_id: id });
  }
  return Response.json({ ok: true, approval: updated, sent });
}
