/**
 * Agent runtime: runs one agent against the platform tools with Claude.
 * Used by the office chat, by the SMS receptionist, and by webhooks that wake
 * an agent (missed call, Zoom voicemail, website lead).
 */
import Anthropic from "@anthropic-ai/sdk";
import { env, hasAnthropic } from "../env";
import { db, companyId, type AgentAction } from "../db";
import { getAgent, type AgentId } from "./registry";
import { buildTools, type ToolContext } from "./tools";

let anthropic: Anthropic | null = null;
const client = () => (anthropic ??= new Anthropic({ apiKey: env.anthropicApiKey }));

export interface RunAgentInput {
  agentId: AgentId;
  message: string;
  history?: Anthropic.Beta.BetaMessageParam[];
  triggerSource: string;
  leadId?: string;
  clientId?: string;
  callId?: string;
  effort?: "low" | "medium" | "high";
}

export interface RunAgentResult {
  text: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  toolCalls: { name: string; input: unknown }[];
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error(`Unknown agent ${input.agentId}`);
  const ctx: ToolContext = { agentId: agent.id, triggerSource: input.triggerSource, leadId: input.leadId, clientId: input.clientId, callId: input.callId };
  const tools = buildTools(ctx, agent.tools);
  const messages: Anthropic.Beta.BetaMessageParam[] = [...(input.history ?? []), { role: "user", content: input.message }];

  if (!hasAnthropic()) {
    // Preview / test mode: no model, but the platform still records the request.
    const cid = await companyId();
    await db.insert<AgentAction>("agent_actions", { company_id: cid, agent_id: agent.id, action: "chat_without_model", input: { message: input.message } as never, status: "failed", trigger_source: input.triggerSource });
    return { text: `${agent.name} is offline: ANTHROPIC_API_KEY is not configured. Your message was logged.`, messages, toolCalls: [] };
  }

  const runner = client().beta.messages.toolRunner({
    model: env.agentModel,
    max_tokens: 16000,
    system: [{ type: "text", text: agent.system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: input.effort ?? "medium" },
    tools,
    messages,
    max_iterations: 12,
  });

  const toolCalls: { name: string; input: unknown }[] = [];
  let final: Anthropic.Beta.BetaMessage | null = null;
  for await (const message of runner) {
    final = message;
    for (const block of message.content) if (block.type === "tool_use") toolCalls.push({ name: block.name, input: block.input });
    if (message.stop_reason === "pause_turn") runner.pushMessages({ role: "assistant", content: message.content });
  }
  final = (await runner.done()) ?? final;
  const text = final?.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim() ?? "";
  const cid = await companyId();
  await db.insert<AgentAction>("agent_actions", { company_id: cid, agent_id: agent.id, action: "respond", input: { message: input.message } as never, output: { text: text.slice(0, 2000), tool_calls: toolCalls.map((t) => t.name) } as never, status: "done", trigger_source: input.triggerSource, entity_type: input.leadId ? "lead" : undefined, entity_id: input.leadId });
  return { text, messages: [...messages, ...(final ? [{ role: "assistant" as const, content: final.content }] : [])], toolCalls };
}
