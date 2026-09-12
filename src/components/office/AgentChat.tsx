"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string; tools?: string[] };
interface SpeechRecognitionLike { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start(): void; stop(): void }

export function AgentChat({ agentId, agentName, leadId }: { agentId: string; agentName: string; leadId?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState(leadId ? `Work on lead ${leadId}.` : "");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const session = useRef(`s${Date.now().toString(36)}`);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(`/api/agents/${agentId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history, lead_id: leadId, session: session.current }) });
      const j = (await r.json()) as { text?: string; history?: unknown[]; tool_calls?: { name: string }[]; error?: string };
      setMsgs((m) => [...m, { role: "assistant", text: j.text ?? j.error ?? "(no reply)", tools: j.tool_calls?.map((t) => t.name) }]);
      if (j.history) setHistory(j.history);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function talk() {
    const w = typeof window !== "undefined" ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }) : undefined;
    const SR = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
    if (!SR) return alert("Voice input needs Chrome or Safari.");
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => { const t = e.results[0][0].transcript; setInput(t); void send(t); };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {msgs.length === 0 && <div className="text-sm text-stone-500">Talk to {agentName} the way you would in the truck. Tap the mic or type.</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-stone-900 text-white ml-auto" : "bg-stone-100"}`}>
            {m.text}
            {m.tools?.length ? <div className="text-[10px] uppercase tracking-wide text-stone-400 mt-1">did: {m.tools.join(", ")}</div> : null}
          </div>
        ))}
        {busy && <div className="text-xs text-stone-400">{agentName} is working…</div>}
        <div ref={bottom} />
      </div>
      <form className="border-t p-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <button type="button" onClick={talk} className={`rounded-lg px-3 ${listening ? "bg-red-500 text-white" : "bg-stone-200"}`} aria-label="Speak">🎤</button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message ${agentName}`} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <button disabled={busy} className="bg-stone-900 text-white rounded-lg px-4 text-sm disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
