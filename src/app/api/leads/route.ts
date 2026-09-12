/** Website contact form → lead → Caroline drafts the first reply for approval. */
import { db, companyId, normalizePhone, type Lead } from "@/lib/db";
import { runAgent } from "@/lib/agents/runtime";
import { hasAnthropic } from "@/lib/env";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const data = (await req.json()) as { name?: string; email?: string; phone?: string; projectType?: string; message?: string };
  if (!data.name || !data.message || !(data.email || data.phone)) return Response.json({ error: "Name, message, and an email or phone are required." }, { status: 400 });
  const cid = await companyId();
  const lead = await db.insert<Lead>("leads", { company_id: cid, name: data.name, email: data.email ?? null, phone: data.phone ? normalizePhone(data.phone) : null, project_type: data.projectType ?? null, description: data.message, source: "website", stage: "new", owner_agent: "receptionist" });
  if (hasAnthropic()) {
    runAgent({ agentId: "receptionist", message: `New website inquiry. Lead id ${lead.id}. Name: ${data.name}. Phone: ${data.phone ?? "n/a"}. Email: ${data.email ?? "n/a"}. Project: ${data.projectType ?? "n/a"}. Message: "${data.message}". Draft the first reply (call-first, under 120 words) with draft_client_message and set an estimated_revenue on the lead if the project type implies one.`, triggerSource: `lead:${lead.id}`, leadId: lead.id, effort: "low" }).catch(() => {});
  }
  return Response.json({ success: true, leadId: lead.id, message: "Thanks! Caroline has your request and Tyler will reach out shortly." });
}

export async function GET(req: Request) {
  const { requireOffice } = await import("@/lib/office-auth");
  const denied = await requireOffice(req);
  if (denied) return denied;
  const cid = await companyId();
  return Response.json({ leads: await db.list<Lead>("leads", { company_id: cid }, { limit: 100 }) });
}
