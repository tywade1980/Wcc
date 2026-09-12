# Wade Platform — how it fits together

## One sentence
wadecustomcarpentry.com is the company: marketing site on the front, the office
app behind `/office`, the AI staff inside it, the business phone routed through
it, and a client portal off it. Every piece of data any agent touches lives in
one Postgres schema.

## Layout

```
src/app/(site)/          public website + legacy admin (unchanged look)
src/app/office/          the office PWA (Today, Inbox, Leads, Staff, Work, Settings)
src/app/portal/[token]   client view + approve/request-changes on any deliverable
src/app/api/voice/*      Twilio voice webhooks (Caroline answers, transfers, voicemail)
src/app/api/sms/inbound  Twilio SMS webhook (Caroline texts back)
src/app/api/zoom/*       Zoom Workplace webhooks + meeting creation
src/app/api/agents/*     chat with any agent
src/app/api/leads        website form → lead → Caroline drafts the first reply
src/app/api/approvals/*  Tyler approves/rejects anything client-facing
src/app/api/deliverables edit/version/share agent output
src/lib/agents/          registry (11 roles), tools (typed, logged), runtime (Claude)
src/lib/telephony/       receptionist brain, routing rules, TwiML builders
src/lib/integrations/    zoom.ts, google-calendar.ts
src/lib/domain/          catalogue, invoice, assembly taxonomy, estimate math
src/lib/db.ts            Supabase store with in-memory fallback
supabase/migrations/     schema + RLS
```

## The phone

```
Caller dials 614-359-7218
   │  (number ported to Twilio, or forwarded from Zoom Phone / carrier)
   ▼
Twilio → POST /api/voice/inbound
   │  screenNumber(): robocall prefixes → voicemail; blocked → reject
   ▼
<Gather speech> Caroline greets (known clients greeted by name)
   │
   ▼  each turn: POST /api/voice/turn?call=<id>
Claude (structured output: reply · intent · extracted · action · summary)
   ├─ continue  → <Say reply> + <Gather>
   ├─ book      → lead updated, appointment proposed, goodbye, SMS to Tyler
   ├─ transfer  → <Dial> Tyler's mobile with a whisper ("Caroline here. Jane, about a kitchen.")
   │               answered → bridged, call marked transferred
   │               no answer → voicemail with transcription, SMS to Tyler
   ├─ voicemail → <Record transcribe>
   └─ end       → goodbye
Twilio status callback → POST /api/voice/status (duration, missed-call text-back)
```

Every call is a `calls` row with `call_turns` (full transcript), `extracted`
fields, intent, outcome, summary, and a link to the lead it created or updated.
The office Inbox shows it the moment it happens; Tyler can call back with one tap.

Routing policy (`src/lib/telephony/routing.ts`) can override the model: after
hours, "transfer" becomes voicemail; spam is ended; existing clients during
hours are transferred when `OWNER_MOBILE` is set.

### Twilio setup
1. Buy a local 614 number (or port 614-359-7218). Register A2P 10DLC before texting.
2. Phone number → Voice: "A call comes in" = `POST {BASE}/api/voice/inbound`; Status callback = `POST {BASE}/api/voice/status`.
3. Messaging: "A message comes in" = `POST {BASE}/api/sms/inbound`.
4. Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OWNER_MOBILE`, `PLATFORM_BASE_URL`.
5. Signature validation is on by default. Set `TWILIO_SKIP_SIGNATURE_VALIDATION=true` only for local testing.

Lower-latency option: `conversationRelayTwiml()` is ready for Twilio
ConversationRelay (streaming STT/TTS over WebSocket). Vercel functions do not
hold WebSockets, so that path needs a small always-on host (Fly.io, Railway,
RunPod). The Gather loop is the default because it runs on Vercel as-is.

## Zoom Workplace
Zoom is the video and, optionally, the phone carrier.
- **Meetings**: `attachZoomToAppointment()` creates a waiting-room, cloud-recorded consult and stores the join link on the appointment. Office action: `POST /api/zoom/meetings {appointment_id}`.
- **Zoom Phone**: subscribe the S2S app to `phone.callee_missed`, `phone.callee_answered`, `phone.callee_ended`, `phone.voicemail_received`, `phone.recording_completed`. They land in the same `calls` table, so the Inbox is one list whether Twilio or Zoom carried the call. Missed Zoom calls get Caroline's text-back through Twilio.
- **Recommended topology**: keep Zoom Phone as Tyler's handset/number if he likes it, and set its "when unanswered / after hours" forwarding to the Twilio number so Caroline picks up. Or port the number to Twilio and make Zoom purely video. Both work with this code.
- Setup: Zoom Marketplace → Server-to-Server OAuth app → scopes `meeting:write:admin`, `phone:read:admin`, `phone_recording:read:admin` → Event Subscriptions → endpoint `{BASE}/api/zoom/webhook` (URL validation is handled). Env: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`.

## The staff (agents)
| id | name | title | phone |
|---|---|---|---|
| receptionist | Caroline | Front Desk Receptionist | yes |
| executive-assistant | Hermes | Executive Assistant & Planner | |
| estimator | Sawyer | Estimator | |
| architect | Drafter | Architect / Drafter (SVG plans, shop drawings, cut lists) | |
| interior-designer | Ivy | Interior Designer (boards, selections, 3D-ready room specs) | |
| project-manager | Mason | Project Manager | |
| production-manager | Field Ops | Production / Field Operations | |
| project-planner | Atlas | Planner & Researcher | |
| finance | Ledger | Finance & Bookkeeping | |
| warranties | Guardian | Warranty Manager | |
| ceo | Chief of Staff | CEO Advisor | |

Rules that hold for all of them:
- They act only through `src/lib/agents/tools.ts`. Every call writes an `agent_actions` row (who, what, from which call/text/chat).
- Anything client-facing (message, estimate, board, booking confirmation, invoice) becomes an `approvals` row. Tyler approves from the Today screen; approving an SMS sends it.
- Their output is a `deliverable` (markdown, JSON, HTML, or SVG). Tyler edits it in the office (versions kept), shares it by link, and the client approves in the portal.
- Handoffs between agents are recorded (`handoffs`) and visible.
- Model: `claude-opus-5` by default (`AGENT_MODEL`, `RECEPTIONIST_MODEL`); the receptionist runs at low effort for phone latency.

## Data
`supabase/migrations/0001_platform.sql`: companies, company_users, clients,
leads, projects, calls, call_turns, messages, appointments, estimates,
estimate_line_items, invoices, payments, daily_logs, time_entries, tasks,
handoffs, agent_actions, approvals, deliverables, deliverable_versions,
integration_events. Every row has `company_id`; RLS scopes authenticated users
to their companies; the server uses the service role. `legacy_ref` on clients,
leads, projects, estimates, invoices keeps Houzz numbers through migration.

To apply: resume the `wcc-retained-data` Supabase project (it is paused), run
the migration in the SQL editor, set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`.

## Auth
`/office` is behind a passcode (`OFFICE_PASSCODE`) with a signed cookie
(`OFFICE_SESSION_SECRET`). That is right for a one-person shop today; the
`company_users` table and RLS are ready for Supabase Auth when staff or clients
need their own logins. The portal uses per-deliverable share tokens.

## Deploy
Vercel: import the repo, set the env vars from `.env.example`, done. Point the
domain at it. Twilio and Zoom need the public URL in `PLATFORM_BASE_URL`.

## What is deliberately not here yet
- Stripe (card/ACH) on invoices; QuickBooks sync.
- Google Calendar write on appointment confirmation is implemented in
  `google-calendar.ts` but not yet wired to the confirm button.
- 3D rendering of the designer's room spec (the spec format is defined; the
  renderer is a follow-up).
- DXF export for drawings (SVG is produced; conversion is a follow-up).
- Houzz migration import (CSV → tables with `legacy_ref`).
- ConversationRelay WebSocket host.
