# Wade Platform

The whole company on one web app: the public site for Wade Custom Carpentry, the
office (`/office`) that replaces Houzz Pro, the AI staff (one agent per job
title), the phone system (the business line rings into the app and Caroline
answers), and the client portal. Built on Next.js 15, Supabase, Twilio, Zoom
Workplace, and the Claude API.

- `PLATFORM.md` — architecture, call flow, how to wire Twilio / Zoom / Supabase / Vercel.
- `docs/INTEGRATION_MAP.md` — what was taken from each of the 22 repos and where it now lives.
- `supabase/migrations/0001_platform.sql` — the one schema.

## Run it

```bash
cp .env.example .env.local   # fill in what you have; everything is optional for a local boot
npm install
npm run dev                  # http://localhost:3000/office
npm test                     # unit tests (estimating, routing, TwiML, receptionist flow, Zoom, calendar)
npm run typecheck && npm run build
```

Without `SUPABASE_URL` the app runs on an in-memory store; without
`ANTHROPIC_API_KEY` the agents answer with an "offline" notice but every
route still works, so previews and tests never need secrets.
