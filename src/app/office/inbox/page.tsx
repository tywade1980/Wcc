import Link from "next/link";
import { db, companyId, type Call, type Message } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function Inbox() {
  const cid = await companyId();
  const [calls, msgs] = await Promise.all([
    db.list<Call>("calls", { company_id: cid }, { limit: 50, orderBy: "started_at" }),
    db.list<Message>("messages", { company_id: cid }, { limit: 50 }),
  ]);
  const items = [
    ...calls.map((c) => ({ kind: "call" as const, at: c.started_at, id: c.id, who: c.caller_name ?? c.from_number ?? "Unknown", line: c.summary ?? c.status, badge: `${c.provider} · ${c.status}` })),
    ...msgs.map((m) => ({ kind: "msg" as const, at: m.created_at as string, id: m.id, who: (m.direction === "inbound" ? m.from_address : m.to_address) ?? "", line: m.body, badge: `${m.channel} · ${m.direction}` })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <p className="text-sm text-stone-500">Every call and text on the business line, whichever provider carried it.</p>
      {items.length === 0 && <p className="text-sm text-stone-500">Empty. Point the Twilio number and Zoom webhooks at this app and this fills itself.</p>}
      {items.map((i) => {
        const inner = (
          <>
            <div className="flex justify-between text-sm"><span className="font-medium">{i.who}</span><span className="text-stone-500">{new Date(i.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
            <div className="text-sm text-stone-700 line-clamp-2">{i.line}</div>
            <div className="text-[11px] uppercase tracking-wide text-stone-400 mt-1">{i.badge}</div>
          </>
        );
        return i.kind === "call" ? <Link key={i.id} href={`/office/inbox/${i.id}`} className="block bg-white rounded-lg p-3 shadow-sm hover:bg-stone-50">{inner}</Link> : <div key={i.id} className="bg-white rounded-lg p-3 shadow-sm">{inner}</div>;
      })}
    </div>
  );
}
