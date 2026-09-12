import { db, companyId, type Lead } from "@/lib/db";
export const dynamic = "force-dynamic";
const STAGES = ["new", "connected", "followed_up", "meeting_scheduled", "estimate_sent", "won", "lost"];

export default async function Leads() {
  const cid = await companyId();
  const leads = await db.list<Lead>("leads", { company_id: cid }, { limit: 200 });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Leads</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((s) => {
          const rows = leads.filter((l) => l.stage === s);
          if (!rows.length && !["new", "connected", "meeting_scheduled"].includes(s)) return null;
          return (
            <div key={s} className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-stone-500">{s.replace(/_/g, " ")} · {rows.length}</div>
              {rows.map((l) => (
                <div key={l.id} className="bg-white rounded-lg p-3 shadow-sm text-sm">
                  <div className="font-medium">{l.name ?? l.phone ?? l.email ?? "Unnamed"}</div>
                  <div className="text-stone-600">{l.project_type ?? "—"}{l.address ? ` · ${l.address}` : ""}</div>
                  {l.next_task && <div className="text-amber-700 text-xs mt-1">Next: {l.next_task}</div>}
                  <div className="text-[11px] text-stone-400 mt-1">{l.source} · {new Date(l.created_at as string).toLocaleDateString()}{l.estimated_revenue ? ` · $${Number(l.estimated_revenue).toLocaleString()}` : ""}</div>
                  <div className="flex gap-2 mt-2">
                    {l.phone && <a href={`tel:${l.phone}`} className="text-xs bg-stone-900 text-white rounded px-2 py-1">Call</a>}
                    {l.phone && <a href={`sms:${l.phone}`} className="text-xs border rounded px-2 py-1">Text</a>}
                    <a href={`/office/agents/estimator?lead=${l.id}`} className="text-xs border rounded px-2 py-1">Estimate</a>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
