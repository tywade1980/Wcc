/** Office chat with any agent. Body: { message, history? , lead_id? }. Returns { text, history, tool_calls }. */
import { runAgent } from "@/lib/agents/runtime";
import { getAgent, type AgentId } from "@/lib/agents/registry";
import { requireOffice } from "@/lib/office-auth";
import type Anthropic from "@anthropic-ai/sdk";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const denied = await requireOffice(req);
  if (denied) return denied;
  const { agent } = await params;
  if (!getAgent(agent)) return Response.json({ error: "unknown agent" }, { status: 404 });
  const body = (await req.json()) as { message: string; history?: Anthropic.Beta.BetaMessageParam[]; lead_id?: string; session?: string };
  const result = await runAgent({ agentId: agent as AgentId, message: body.message, history: body.history, triggerSource: `chat:${body.session ?? "office"}`, leadId: body.lead_id, effort: "medium" });
  return Response.json({ text: result.text, history: result.messages, tool_calls: result.toolCalls });
}
