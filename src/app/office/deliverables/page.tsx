import Link from "next/link";
import { db, companyId, type Deliverable } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function Deliverables() {
  const cid = await companyId();
  const rows = await db.list<Deliverable>("deliverables", { company_id: cid }, { limit: 100 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Work product</h1>
      <p className="text-sm text-stone-500">Everything the staff produces: proposals, drawings, boards, reports. Open one to edit, save a version, or share with a client for approval.</p>
      {rows.length === 0 && <p className="text-sm text-stone-500">Nothing yet. Ask the Estimator for a proposal or the Drafter for a plan and it lands here.</p>}
      {rows.map((d) => (
        <Link key={d.id} href={`/office/deliverables/${d.id}`} className="block bg-white rounded-lg p-3 shadow-sm hover:bg-stone-50 text-sm">
          <div className="flex justify-between"><span className="font-medium">{d.title}</span><span className={`text-xs px-2 rounded-full ${d.status === "approved" ? "bg-emerald-100 text-emerald-800" : d.status === "shared" ? "bg-blue-100 text-blue-800" : "bg-stone-100"}`}>{d.status}</span></div>
          <div className="text-stone-500 text-xs">{d.kind} · by {d.agent_id} · v{d.version} · {d.format}</div>
        </Link>
      ))}
    </div>
  );
}
