"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deliverable } from "@/lib/db";
import { RenderContent } from "./RenderContent";

export function DeliverableEditor({ deliverable, shareUrl }: { deliverable: Deliverable; shareUrl: string }) {
  const router = useRouter();
  const [content, setContent] = useState(deliverable.content);
  const [title, setTitle] = useState(deliverable.title);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [busy, setBusy] = useState(false);
  const dirty = content !== deliverable.content || title !== deliverable.title;

  async function save(status?: string) {
    setBusy(true);
    await fetch(`/api/deliverables/${deliverable.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, title, status }) });
    setBusy(false);
    router.refresh();
  }
  async function share() {
    await save("shared");
    if (navigator.share) await navigator.share({ title, url: shareUrl }).catch(() => {});
    else { await navigator.clipboard.writeText(shareUrl); alert("Client link copied."); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold bg-transparent border-b border-transparent focus:border-stone-400 outline-none flex-1 min-w-[200px]" />
        <span className="text-xs text-stone-500">v{deliverable.version} · {deliverable.status} · {deliverable.agent_id}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMode(mode === "edit" ? "preview" : "edit")} className="border rounded px-3 py-1.5 text-sm">{mode === "edit" ? "Preview" : "Edit"}</button>
        <button disabled={!dirty || busy} onClick={() => save()} className="bg-stone-900 text-white rounded px-3 py-1.5 text-sm disabled:opacity-40">Save version</button>
        <button disabled={busy} onClick={share} className="bg-blue-700 text-white rounded px-3 py-1.5 text-sm">Share with client</button>
        <button disabled={busy} onClick={() => save("approved")} className="bg-emerald-700 text-white rounded px-3 py-1.5 text-sm">Mark approved</button>
      </div>
      {deliverable.client_decision && <div className="text-sm bg-emerald-50 border border-emerald-200 rounded p-2">Client {deliverable.client_decision} this on {new Date(String(deliverable.client_decided_at)).toLocaleString()}.</div>}
      <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        {mode === "edit" ? <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={28} className="w-full font-mono text-sm border rounded p-2" /> : <RenderContent format={deliverable.format} content={content} />}
      </div>
    </div>
  );
}
