# Integration map — 22 repos → one platform

What each repository contributed, where it now lives, and what was left behind.
"Ported" means the logic is in this repo now; "reference" means the idea is used
but the code was rewritten for the web stack; "retired" means nothing was
worth carrying.

| Repo | What it was | Disposition | Where it lives now |
|---|---|---|---|
| **Wcc** | Next.js marketing site + mock admin | **Host.** Site kept under `src/app/(site)`; admin left as-is; platform added | this repo |
| **ai-receptionist-app** | Android call interceptor + FastAPI receptionist (Whisper→LLM→ElevenLabs), JSON turn contract `{reply, extracted, action}` | Ported (contract, prompt rules, booking logic) | `src/lib/telephony/receptionist.ts` |
| **caroline-android** | Native call screening, xAI realtime audio, 6 Caroline personas, Room call log with intent/urgency | Ported (receptionist persona, screening heuristics, call-record fields) | `src/lib/agents/registry.ts` (receptionist), `src/lib/telephony/routing.ts`, `calls` table |
| **smart-incallservice** | Generic 8-agent Android receptionist, routing-rule table, REST/webhook surface | Ported (routing rules → `routeIntent`, call data model) | `src/lib/telephony/routing.ts`, schema |
| **unified-agentic-ai-foundation** | Umbrella monorepo; WCC_Pro orchestrator with assembly taxonomy + estimate/proposal tools; nextgentele Node telephony; `caroline_receptionist.py` (Twilio Gather loop) | Ported (taxonomy, estimate math, proposal generator, Twilio Gather→LLM→Say loop, transfer/voicemail TwiML) | `src/lib/domain/assemblies.ts`, `estimating.ts`, `src/lib/telephony/twiml.ts` |
| **nextgenbuildpro** | Android CRM + TS catalogue/pricing stack with tests; Invoice model; C-suite orchestrators | Ported (CatalogueSchema.ts, Invoice.ts verbatim; estimate line-item shape) | `src/lib/domain/catalogue.ts`, `invoice.ts`, `estimate_line_items` |
| **rsmeans-mobile-app** | Expo app; RSMeans estimator prompt + JSON schema; Google Calendar OAuth service with conflict detection | Ported (calendar service rewritten on REST; estimator prompt folded into Sawyer; CSI/RSMeans fields on line items) | `src/lib/integrations/google-calendar.ts`, estimator agent |
| **ngbp-v2-0** | Clean-arch Android "master app", 2025 regional material pricing seed | Reference (pricing seed is a follow-up import into the catalogue tables) | — |
| **wade-global-state** | Global state JSON, Hermes router with AuditAgent, agent registry schema, "Tyler only talks to Caroline" rule | Reference (agent registry shape, EA named Hermes, audit-before-send became the approvals gate) | `src/lib/agents/registry.ts`, `approvals` |
| **centauri-os** | Event-bus + NeuroRank scoring + 3-tier memory + Caroline voice prosody | Reference (attributable action log replaces the bus; memory tiers → follow-up on mem0) | `agent_actions` |
| **manus-master-archive** | 18 packaged skills (interlock, wade-custom-carpentry, rsmeans-cost-estimator, wade-telephony), API key registry | Reference (skill content informed agent prompts). **Action:** rotate the RunPod key partially exposed in `centauri_api_key_registry.md` | — |
| **voice-ai-app** | Expo Caroline voice orb on xAI realtime; `CAROLINE_SOUL` prompt | Reference (voice-in on every office screen uses browser speech; soul prompt informed tone) | `AgentChat.tsx` |
| **unified-brain** | RunPod vLLM + Fish Speech bridge; persona/voice registries | Retired (uncensored default persona is not client-safe; voice now via Twilio TTS) | — |
| **model-downloader** | HF/Ollama model fetcher CLI | Retired for the platform (useful only for self-hosted models) | — |
| **mcp-mem0 / mem0** | Mem0 memory MCP server; provider factory | Follow-up (long-term agent memory service; the tools layer is where it plugs in) | — |
| **action** | Third-party workshop repo (OpenAI Agents SDK / CrewAI) | Retired (not owned IP) | — |
| **zapier-mcp** | Docs only | Retired (Zapier stays a hosted connector if ever needed) | — |
| **telephony, Bms, Constructpro, csr.ai** | Empty stubs | Retired (names only) | — |

## Live services found on the accounts
- **Supabase**: `wcc-retained-data` (paused) and a Dreamflow project (paused). The migration targets `wcc-retained-data`.
- **Vercel**: team "tyler's projects" (hobby), one unrelated project. This repo deploys as a new project.
- **Base44**: BuildStock (projects/materials/daily logs/cost entries), Project AI Planner (19 entities: clients, vendors, crew, labor rates, task templates, invoices, proposals…), Command Center, Cowork Mobile. Their entity shapes were compared while designing the schema; Project AI Planner's TaskTemplate learning fields (user_adjusted_duration, adjustment_confidence) are the model for the EA's estimate-to-actual loop and are a follow-up import.

## Security items surfaced during the survey
1. `manus-master-archive/centauri_api_key_registry.md` shows part of a RunPod key: rotate it.
2. `ai-receptionist-app/app/build.gradle.kts` bakes a live RunPod proxy hostname into the APK.
3. `Wcc/src/app/(site)/admin/page.tsx` still has a hardcoded admin login in client JS (legacy console; the new office uses a server-side passcode + signed cookie). Delete the legacy admin once the office covers it.
4. `unified-agentic-ai-foundation` orchestrator `add_tool_to_agent` runs `exec()` on model-generated code; nothing like it exists in the platform.
