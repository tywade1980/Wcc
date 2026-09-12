import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type Call, type CallTurn } from "@/lib/db";
export const dynamic = "force-dynamic";

export default async function CallDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await db.get<Call>("calls", id);
  if (!call) notFound();
  const turns = await db.list<CallTurn>("call_turns", { call_id: id }, { orderBy: "seq", asc: true });
  const x = call.extracted as Record<string, string | null>;
  return (
    <div className="space-y-4">
      <Link href="/office/inbox" className="text-sm text-stone-500">← Inbox</Link>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h1 className="text-lg font-semibold">{call.caller_name ?? call.from_number ?? "Unknown caller"}</h1>
        <div className="text-sm text-stone-600">{call.from_number} · {call.provider} · {call.status}{call.duration_seconds ? ` · ${call.duration_seconds}s` : ""}</div>
        <div className="text-sm mt-2">{call.summary}</div>
        {call.lead_id && <Link href="/office/leads" className="text-sm text-blue-700 underline mt-1 inline-block">Open lead</Link>}
        {call.from_number && <a href={`tel:${call.from_number}`} className="ml-3 inline-block mt-2 bg-stone-900 text-white text-sm rounded px-3 py-1.5">Call back</a>}
      </div>
      {Object.values(x).some(Boolean) && (
        <div className="bg-white rounded-xl p-4 shadow-sm text-sm grid grid-cols-2 gap-2">
          {Object.entries(x).filter(([, v]) => v).map(([k, v]) => (<div key={k}><div className="text-[11px] uppercase text-stone-400">{k.replace(/_/g, " ")}</div><div>{v}</div></div>))}
        </div>
      )}
      {call.voicemail_transcript && <div className="bg-white rounded-xl p-4 shadow-sm text-sm"><div className="text-[11px] uppercase text-stone-400">Voicemail</div>{call.voicemail_transcript}</div>}
      {call.recording_url && <audio controls src={call.recording_url} className="w-full" />}
      {turns.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
          <div className="text-[11px] uppercase text-stone-400">Transcript</div>
          {turns.map((t) => (
            <div key={t.id} className={`text-sm ${t.speaker === "caller" ? "text-stone-900" : "text-stone-600"}`}><span className="font-medium">{t.speaker === "caller" ? "Caller" : "Caroline"}:</span> {t.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
