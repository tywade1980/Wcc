import Link from "next/link";
import { db, companyId, type Lead, type Call, type Approval, type Appointment } from "@/lib/db";
import { ApprovalCard } from "@/components/office/ApprovalCard";
import { AGENTS } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export default async function Today() {
  const cid = await companyId();
  const [newLeads, calls, approvals, appts] = await Promise.all([
    db.list<Lead>("leads", { company_id: cid, stage: "new" }, { limit: 10 }),
    db.list<Call>("calls", { company_id: cid }, { limit: 8, orderBy: "started_at" }),
    db.list<Approval>("approvals", { company_id: cid, status: "pending" }, { limit: 20 }),
    db.list<Appointment>("appointments", { company_id: cid, status: "proposed" }, { limit: 10 }),
  ]);
  const needCallback = calls.filter((c) => ["voicemail", "missed"].includes(c.status) || c.outcome === "message_taken");
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="New leads" value={newLeads.length} href="/office/leads" />
        <Stat label="Call back" value={needCallback.length} href="/office/inbox" />
        <Stat label="To approve" value={approvals.length} href="#approvals" />
        <Stat label="Visits to confirm" value={appts.length} href="/office/leads" />
      </section>

      <section id="approvals" className="space-y-2">
        <h2 className="font-semibold">Waiting on you</h2>
        {approvals.length === 0 && <p className="text-sm text-stone-500">Nothing pending. The staff will queue anything client-facing here.</p>}
        {approvals.map((a) => <ApprovalCard key={a.id} approval={a} />)}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Visits to confirm</h2>
        {appts.length === 0 && <p className="text-sm text-stone-500">No proposed visits.</p>}
        {appts.map((a) => (
          <div key={a.id} className="bg-white rounded-lg p-3 shadow-sm text-sm">
            <div className="font-medium">{a.title}</div>
            <div className="text-stone-600">Windows: {(a.proposed_windows as string[]).join(" · ") || "none given"}{a.location ? ` · ${a.location}` : ""}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Latest calls</h2>
        {calls.length === 0 && <p className="text-sm text-stone-500">No calls yet. Once the Twilio number points at this app, Caroline logs every call here.</p>}
        {calls.map((c) => (
          <Link key={c.id} href={`/office/inbox/${c.id}`} className="block bg-white rounded-lg p-3 shadow-sm text-sm hover:bg-stone-50">
            <div className="flex justify-between"><span className="font-medium">{c.caller_name ?? c.from_number ?? "Unknown"}</span><span className="text-stone-500">{new Date(c.started_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
            <div className="text-stone-600">{c.summary ?? c.status}</div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Talk to the staff</h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(AGENTS).map((a) => (
            <Link key={a.id} href={`/office/agents/${a.id}`} className="bg-white rounded-full px-3 py-1.5 text-sm shadow-sm hover:bg-stone-50">{a.name} <span className="text-stone-500">· {a.title}</span></Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl p-4 shadow-sm">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
    </Link>
  );
}
