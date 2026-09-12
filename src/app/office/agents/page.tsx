import Link from "next/link";
import { AGENT_LIST } from "@/lib/agents/registry";
import { db, companyId, type AgentAction } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function Staff() {
  const cid = await companyId();
  const recent = await db.list<AgentAction>("agent_actions", { company_id: cid }, { limit: 200 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Staff</h1>
      <p className="text-sm text-stone-500">One agent per job. Each one works through the same office data and everything they do is logged.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {AGENT_LIST.map((a) => {
          const n = recent.filter((r) => r.agent_id === a.id).length;
          return (
            <Link key={a.id} href={`/office/agents/${a.id}`} className="bg-white rounded-xl p-4 shadow-sm hover:bg-stone-50">
              <div className="flex items-baseline justify-between"><span className="font-semibold">{a.name}</span><span className="text-xs text-stone-400">{n} actions</span></div>
              <div className="text-sm text-stone-700">{a.title}{a.voice ? " · answers the phone" : ""}</div>
              <div className="text-sm text-stone-500 mt-1">{a.summary}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
