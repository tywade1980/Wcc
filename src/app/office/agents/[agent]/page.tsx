import { notFound } from "next/navigation";
import { getAgent } from "@/lib/agents/registry";
import { db, companyId, type AgentAction } from "@/lib/db";
import { AgentChat } from "@/components/office/AgentChat";
export const dynamic = "force-dynamic";

export default async function AgentPage({ params, searchParams }: { params: Promise<{ agent: string }>; searchParams: Promise<{ lead?: string }> }) {
  const { agent: id } = await params;
  const { lead } = await searchParams;
  const agent = getAgent(id);
  if (!agent) notFound();
  const cid = await companyId();
  const actions = (await db.list<AgentAction>("agent_actions", { company_id: cid, agent_id: agent.id }, { limit: 15 }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-xl font-semibold">{agent.name} <span className="text-stone-500 font-normal">· {agent.title}</span></h1>
        <p className="text-sm text-stone-500 mb-3">{agent.summary}</p>
        <AgentChat agentId={agent.id} agentName={agent.name} leadId={lead} />
      </div>
      <aside className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-stone-500">Recent actions</div>
        {actions.length === 0 && <div className="text-sm text-stone-500">None yet.</div>}
        {actions.map((a) => (
          <div key={a.id} className="bg-white rounded-lg p-2 shadow-sm text-xs">
            <div className="font-medium">{a.action} <span className="text-stone-400">· {a.status}</span></div>
            <div className="text-stone-500">{new Date(a.created_at as string).toLocaleString()}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}
