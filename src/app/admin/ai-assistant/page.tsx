"use client";

import React, { useState, useRef, useEffect } from 'react';
import { AIMessage } from '@/lib/types';

const DOMAINS = [
  { id: 'estimating', label: 'Estimating', color: 'bg-orange-100 text-orange-700' },
  { id: 'scheduling', label: 'Scheduling', color: 'bg-blue-100 text-blue-700' },
  { id: 'clients',    label: 'Clients',    color: 'bg-indigo-100 text-indigo-700' },
  { id: 'general',   label: 'General',    color: 'bg-gray-100 text-gray-700' },
];

const SUGGESTIONS = [
  'How do I price a custom deck build for a 400 sqft patio?',
  'What questions should I ask during an initial consultation?',
  'Draft a follow-up email for a lead that hasn\'t responded.',
  'What\'s a reasonable timeline for a kitchen cabinet refresh?',
  'How do I calculate labor cost for trim work by the linear foot?',
  'Write a professional estimate intro paragraph.',
];

function detectDomain(text: string): string {
  const t = text.toLowerCase();
  if (/price|cost|estimate|quote|labor|material|sqft|linear/.test(t)) return 'estimating';
  if (/schedule|date|timeline|when|appointment|calendar|visit/.test(t)) return 'scheduling';
  if (/client|customer|lead|email|follow.up|contact/.test(t)) return 'clients';
  return 'general';
}

function generateReply(message: string): string {
  const domain = detectDomain(message);
  const m = message.toLowerCase();

  if (domain === 'estimating') {
    if (m.includes('deck')) return 'For a 400 sqft deck, a typical range in the Columbus OH market is $18–$28 per sqft for pressure-treated lumber, or $30–$45/sqft for composite decking. Factor in footings (~$150–$200 each), ledger board, railing ($35–$50/lf), and labor (~$10–$14/sqft). A basic budget estimate: materials ~$6,000–$9,000 + labor ~$4,000–$5,600 = **$10,000–$14,600 total**. Add 15% for overhead and profit.';
    if (m.includes('labor') || m.includes('trim')) return 'Standard trim work labor rates in Ohio run $3.50–$6.50 per linear foot installed, depending on profile complexity. Crown molding is on the higher end ($5–$7/lf); base molding is lower ($3–$5/lf). For door casing sets, charge per opening: $60–$120/door including caulk and nail fill.';
    return 'For estimating, I recommend breaking the job into: (1) **Materials** — get supplier quotes with 10% waste factor; (2) **Labor** — estimate hours × your rate ($65–$95/hr for skilled carpentry in OH); (3) **Overhead** — 15–20% markup; (4) **Profit margin** — 10–15%. Always include a scope-of-work paragraph to avoid change order disputes.';
  }

  if (domain === 'scheduling') {
    if (m.includes('kitchen') || m.includes('cabinet')) return 'A kitchen cabinet refresh (paint, reface, or swap doors) typically runs: **Consultation** 1 hr → **Measuring & design** 2 hrs → **Material lead time** 2–4 weeks → **Install** 2–5 days depending on scope. Block client\'s calendar for a 3-week window from order confirmation to completion. Always schedule a punch-list walkthrough the day after install.';
    return 'For scheduling consultations: book them in 60-min blocks on Tuesday–Thursday mornings (highest show rate). Always send a confirmation text the evening before. Site visits should happen within 48 hrs of a qualified lead expressing interest — strike while the iron is hot. Buffer 30 min between appointments for travel and notes.';
  }

  if (domain === 'clients') {
    if (m.includes('email') || m.includes('follow')) return `Here\'s a professional follow-up template:\n\n---\n**Subject: Following up on your project inquiry**\n\nHi [Name],\n\nI wanted to reach out and check in on the [project type] we discussed. I\'m still very interested in helping you bring your vision to life and have some availability coming up in [timeframe].\n\nWould you be open to a quick 15-minute call this week? I\'m happy to answer any questions and walk you through next steps.\n\nBest,\nTyler Wade\nWade Custom Carpentry | 614-XXX-XXXX\n---`;
    if (m.includes('consult') || m.includes('question')) return 'Key questions for an initial consultation:\n1. What\'s the primary goal — aesthetics, function, or resale value?\n2. Do you have a budget range in mind?\n3. What\'s your ideal timeline?\n4. Have you worked with a contractor before? Any past pain points?\n5. Who else is involved in the decision (spouse, HOA, etc.)?\n6. Are there any materials or styles you love/hate?\n7. Any access restrictions (tight spaces, HOA approval needed)?';
    return 'Best practices for client communication: respond to all inquiries within 2 hours during business hours. Send a written recap after every meeting. Use photos to document job site conditions before starting. Always get scope changes signed before proceeding. A satisfied client is your best marketing — ask for a Google review within 1 week of project completion.';
  }

  return 'I\'m your Wade Custom Carpentry AI assistant. I can help with estimating (pricing, materials, labor), scheduling (timelines, appointments), and client communication (emails, proposals, follow-ups). What can I help you with today?';
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<AIMessage[]>([
    { id: 'm0', role: 'assistant', content: "Hi Tyler! I'm your business AI assistant — powered by the Wade Ecosystem. I can help with estimating, scheduling, client communications, and business advice. What\'s on your mind?", timestamp: new Date().toISOString() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: AIMessage = { id: `m${Date.now()}`, role: 'user', content: text.trim(), timestamp: new Date().toISOString(), domain: detectDomain(text) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    const reply: AIMessage = { id: `m${Date.now()}`, role: 'assistant', content: generateReply(text), timestamp: new Date().toISOString(), domain: detectDomain(text) };
    setMessages(prev => [...prev, reply]);
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Domain pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Specializations:</span>
        {DOMAINS.map(d => (
          <span key={d.id} className={`px-2 py-1 text-xs rounded-full font-medium ${d.color}`}>{d.label}</span>
        ))}
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mr-2 mt-1">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            )}
            <div className={`max-w-xl rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-orange-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
            }`}>
              {msg.content}
              {msg.domain && msg.role === 'assistant' && (
                <span className={`inline-block mt-2 text-xs px-1.5 py-0.5 rounded ${
                  DOMAINS.find(d=>d.id===msg.domain)?.color ?? 'bg-gray-200 text-gray-600'
                }`}>{DOMAINS.find(d=>d.id===msg.domain)?.label ?? msg.domain}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs px-3 py-2 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors shadow-sm">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask about estimating, scheduling, clients, or business advice..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white px-4 py-3 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
