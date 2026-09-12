"use client";
import { useState } from "react";
export function ClientDecision({ id, token, decision }: { id: string; token: string; decision: string | null }) {
  const [state, setState] = useState(decision);
  const [busy, setBusy] = useState(false);
  async function decide(d: "approved" | "rejected") {
    setBusy(true);
    const r = await fetch(`/api/deliverables/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_decision: d, share_token: token }) });
    if (r.ok) setState(d);
    setBusy(false);
  }
  if (state) return <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">You {state} this. Thank you — we&apos;ll follow up shortly.</div>;
  return (
    <div className="flex gap-2">
      <button disabled={busy} onClick={() => decide("approved")} className="flex-1 bg-emerald-600 text-white rounded-lg py-3 font-medium disabled:opacity-50">Approve</button>
      <button disabled={busy} onClick={() => decide("rejected")} className="px-5 border rounded-lg py-3 disabled:opacity-50">Request changes</button>
    </div>
  );
}
