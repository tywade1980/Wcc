-- Wade Platform — unified schema (Supabase / Postgres 17)
-- One schema for the whole company. Every row carries company_id so the
-- platform is multi-entity (WCC / Dublin Remodeling / NGBP / Centauri) from day
-- one and can become multi-tenant if it is ever sold.

create extension if not exists pgcrypto;

-- ── Companies & users ────────────────────────────────────────────────────
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  phone text,
  email text,
  address text,
  timezone text not null default 'America/New_York',
  business_hours jsonb not null default '{"mon":["07:00","18:00"],"tue":["07:00","18:00"],"wed":["07:00","18:00"],"thu":["07:00","18:00"],"fri":["07:00","18:00"],"sat":["08:00","14:00"]}',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  auth_user_id uuid,                -- Supabase auth.users.id once auth is wired
  email text not null,
  name text,
  role text not null default 'owner' check (role in ('owner','staff','client')),
  mobile text,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

-- ── CRM ──────────────────────────────────────────────────────────────────
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  city text, state text, zip text,
  notes text,
  legacy_ref text,                  -- Houzz / Housecall Pro id
  portal_token text unique default encode(gen_random_bytes(16),'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_company_phone on clients(company_id, phone);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text,
  phone text,
  email text,
  address text,
  project_type text,
  description text,
  budget_range text,
  timeline text,
  source text not null default 'website' check (source in ('website','phone','sms','zoom','email','referral','houzz','manual','other')),
  stage text not null default 'new' check (stage in ('new','connected','followed_up','meeting_scheduled','estimate_sent','won','lost')),
  estimated_revenue numeric(12,2),
  urgency text default 'flexible',
  next_task text,
  next_task_due timestamptz,
  owner_agent text default 'receptionist',
  legacy_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_company_stage on leads(company_id, stage, created_at desc);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  name text not null,
  address text,
  project_type text,
  status text not null default 'open' check (status in ('open','in_progress','on_hold','done','cancelled')),
  phase text,
  contract_value numeric(12,2),
  start_date date,
  target_end_date date,
  notes text,
  legacy_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Communications: every call, text, email, portal message ──────────────
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider text not null default 'twilio' check (provider in ('twilio','zoom','manual')),
  provider_call_id text unique,     -- Twilio CallSid / Zoom call_id
  direction text not null check (direction in ('inbound','outbound')),
  from_number text,
  to_number text,
  caller_name text,
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  status text not null default 'in_progress',  -- ringing|in_progress|transferred|voicemail|completed|missed|failed
  handled_by text not null default 'receptionist', -- receptionist|owner|voicemail|zoom
  intent text,
  outcome text,                     -- booked|transferred|message_taken|spam|info|other
  extracted jsonb not null default '{}',
  summary text,
  recording_url text,
  voicemail_transcript text,
  duration_seconds int,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists calls_company_started on calls(company_id, started_at desc);

create table if not exists call_turns (
  id bigserial primary key,
  call_id uuid not null references calls(id) on delete cascade,
  seq int not null,
  speaker text not null check (speaker in ('caller','caroline','system','owner')),
  text text not null,
  confidence real,
  created_at timestamptz not null default now(),
  unique (call_id, seq)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  channel text not null check (channel in ('sms','email','portal','internal','zoom_chat')),
  direction text not null check (direction in ('inbound','outbound')),
  from_address text,
  to_address text,
  body text not null,
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  provider_message_id text,
  sent_by text,                     -- agent id or user email
  approval_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists messages_company_created on messages(company_id, created_at desc);

-- ── Scheduling ───────────────────────────────────────────────────────────
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  kind text not null default 'site_visit' check (kind in ('site_visit','phone_call','zoom_consult','follow_up','other')),
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  proposed_windows jsonb not null default '[]',   -- caller's preferred times before confirmation
  location text,
  status text not null default 'proposed' check (status in ('proposed','confirmed','cancelled','completed')),
  google_event_id text,
  zoom_meeting_id text,
  zoom_join_url text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ── Money ────────────────────────────────────────────────────────────────
create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  number text,                      -- ES-00001 (Houzz numbering kept as legacy_ref)
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  scope text,
  status text not null default 'draft' check (status in ('draft','sent','approved','declined','invoiced','expired')),
  labor_rate numeric(8,2) not null default 85,
  material_total numeric(12,2) not null default 0,
  labor_total numeric(12,2) not null default 0,
  equipment_total numeric(12,2) not null default 0,
  subcontractor_total numeric(12,2) not null default 0,
  overhead_pct numeric(5,2) not null default 20,
  total numeric(12,2) not null default 0,
  confidence int,                   -- 0-100 from the estimator
  assumptions jsonb not null default '[]',
  exclusions jsonb not null default '[]',
  legacy_ref text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  seq int not null default 0,
  phase text,
  name text not null,
  description text,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'ea',
  labor_hours numeric(10,2) not null default 0,
  material_cost numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  equipment_cost numeric(12,2) not null default 0,
  subcontractor_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  csi_division text,
  rsmeans_reference text,
  assembly_id text
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  number text,
  estimate_id uuid references estimates(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  type text not null default 'STANDARD',
  status text not null default 'DRAFT',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  line_items jsonb not null default '[]',
  legacy_ref text,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  amount numeric(12,2) not null,
  method text not null default 'OTHER',
  reference text,
  received_at timestamptz not null default now()
);

-- ── Field ────────────────────────────────────────────────────────────────
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  log_date date not null default current_date,
  phase text,
  work_performed text,
  hours_worked numeric(6,2),
  materials_used text,
  issues text,
  tomorrow_plan text,
  photo_urls jsonb not null default '[]',
  raw_voice_note text,              -- what Tyler actually said
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  task text,
  started_at timestamptz not null,
  ended_at timestamptz,
  hours numeric(6,2),
  notes text,
  created_at timestamptz not null default now()
);

-- ── Agent layer: everything an agent does is attributable & approvable ───
create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_id text not null,           -- receptionist | estimator | ...
  action text not null,             -- tool name
  input jsonb not null default '{}',
  output jsonb,
  status text not null default 'done' check (status in ('done','pending_approval','rejected','failed')),
  trigger_source text,              -- call:<sid> | sms:<sid> | chat:<session> | zoom:<id>
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists agent_actions_company_created on agent_actions(company_id, created_at desc);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_action_id uuid references agent_actions(id) on delete cascade,
  kind text not null,               -- send_message | send_estimate | book_appointment | ...
  summary text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Deliverables: every agent output the owner can open, edit, save, and hand
-- to a client for approval (estimates, proposals, drawings, mood boards, reports).
create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_id text not null,
  kind text not null,               -- proposal | estimate | daily_report | drawing | moodboard | schedule | brief | other
  title text not null,
  format text not null default 'markdown' check (format in ('markdown','json','html','svg','pdf_url')),
  content text not null,
  data jsonb not null default '{}',
  version int not null default 1,
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','review','shared','approved','rejected','archived')),
  share_token text unique default encode(gen_random_bytes(16),'hex'),
  client_decision text,
  client_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deliverable_versions (
  id bigserial primary key,
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  version int not null,
  content text not null,
  data jsonb not null default '{}',
  edited_by text,
  created_at timestamptz not null default now()
);

-- ── Integrations ─────────────────────────────────────────────────────────
create table if not exists integration_events (
  id bigserial primary key,
  company_id uuid references companies(id) on delete cascade,
  provider text not null,           -- zoom | twilio | google | houzz
  event_type text not null,
  provider_event_id text,
  payload jsonb not null,
  processed boolean not null default false,
  received_at timestamptz not null default now()
);
create index if not exists integration_events_provider on integration_events(provider, received_at desc);

-- ── Row level security (service role bypasses; anon/authenticated scoped) ─
alter table companies enable row level security;
alter table company_users enable row level security;
alter table clients enable row level security;
alter table leads enable row level security;
alter table projects enable row level security;
alter table calls enable row level security;
alter table call_turns enable row level security;
alter table messages enable row level security;
alter table appointments enable row level security;
alter table estimates enable row level security;
alter table estimate_line_items enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table daily_logs enable row level security;
alter table time_entries enable row level security;
alter table agent_actions enable row level security;
alter table approvals enable row level security;
alter table deliverables enable row level security;
alter table deliverable_versions enable row level security;
alter table integration_events enable row level security;

-- Helper: companies the signed-in user belongs to
create or replace function my_company_ids() returns setof uuid
language sql stable security definer as $$
  select company_id from company_users where auth_user_id = auth.uid();
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','leads','projects','calls','messages','appointments','estimates','invoices','payments','daily_logs','time_entries','agent_actions','approvals','deliverables','integration_events']
  loop
    execute format('drop policy if exists %I_company_scope on %I', t, t);
    execute format('create policy %I_company_scope on %I for all to authenticated using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()))', t, t);
  end loop;
end $$;

-- Seed the first company
insert into companies (slug, name, phone, email, address)
values ('wcc', 'Wade Custom Carpentry', '+16143597218', null, '9370 Concord Rd, Powell, OH 43065')
on conflict (slug) do nothing;

-- ── Tasks & handoffs (used by every agent) ───────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  notes text,
  assignee text not null default 'tyler',
  due timestamptz,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  lead_id uuid references leads(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  from_agent text not null,
  to_agent text not null,
  reason text,
  priority text not null default 'normal',
  context text,
  action_requested text,
  status text not null default 'queued' check (status in ('queued','in_progress','done')),
  lead_id uuid references leads(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table tasks enable row level security;
alter table handoffs enable row level security;
drop policy if exists tasks_company_scope on tasks;
create policy tasks_company_scope on tasks for all to authenticated using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
drop policy if exists handoffs_company_scope on handoffs;
create policy handoffs_company_scope on handoffs for all to authenticated using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
