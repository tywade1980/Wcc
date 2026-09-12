"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Approval } from "@/lib/db";

export function ApprovalCard({ approval }: { approval: Approval }) {
  const router = useRouter();
  const p = approval.payload as { body?: string; to?: string; channel?: string };
  const [body, setBody] = useState(p.body ?? "");
  const [busy, setBusy] = useState(false);
  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    await fetch(`/api/approvals/${approval.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, edited_body: body !== p.body ? body : undefined }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
      <div className="text-xs uppercase tracking-wide text-amber-700">{approval.kind.replace(/_/g, " ")}</div>
      <div className="text-sm font-medium">{approval.summary}</div>
      {p.body !== undefined && <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full border rounded p-2 text-sm" />}
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide("approved")} className="flex-1 bg-emerald-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50">Approve{p.channel ? ` & send ${p.channel.toUpperCase()}` : ""}</button>
        <button disabled={busy} onClick={() => decide("rejected")} className="px-4 border rounded py-2 text-sm disabled:opacity-50">Reject</button>
      </div>
    </div>
  );
}
