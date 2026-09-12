/**
 * Data access layer.
 *
 * Supabase (Postgres) is the system of record. When SUPABASE_URL is not set
 * (local dev, preview, tests) an in-memory store with the same surface is used
 * so every route and agent still runs end to end.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { env, hasSupabase } from "./env";

export type Row = Record<string, unknown> & { id: string };
type Filter = Record<string, unknown>;

export interface Store {
  insert<T extends Row>(table: string, data: Partial<T>): Promise<T>;
  update<T extends Row>(table: string, id: string, data: Partial<T>): Promise<T>;
  get<T extends Row>(table: string, id: string): Promise<T | null>;
  findOne<T extends Row>(table: string, where: Filter): Promise<T | null>;
  list<T extends Row>(table: string, where?: Filter, opts?: { limit?: number; orderBy?: string; asc?: boolean }): Promise<T[]>;
  count(table: string, where?: Filter): Promise<number>;
}

/* ── In-memory fallback ────────────────────────────────────────────────── */
const memory = new Map<string, Map<string, Row>>();
const tbl = (t: string) => memory.get(t) ?? memory.set(t, new Map()).get(t)!;
const matches = (row: Row, where: Filter) => Object.entries(where).every(([k, v]) => row[k] === v);

const memoryStore: Store = {
  async insert(table, data) {
    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      created_at: now,
      ...(table === "clients" || table === "deliverables" ? { share_token: randomBytes(16).toString("hex"), portal_token: randomBytes(16).toString("hex") } : {}),
      ...data,
    } as Row;
    tbl(table).set(row.id, row);
    return row as never;
  },
  async update(table, id, data) {
    const row = tbl(table).get(id);
    if (!row) throw new Error(`${table}/${id} not found`);
    const next = { ...row, ...data, updated_at: new Date().toISOString() } as Row;
    tbl(table).set(id, next);
    return next as never;
  },
  async get(table, id) {
    return (tbl(table).get(id) as never) ?? null;
  },
  async findOne(table, where) {
    for (const r of tbl(table).values()) if (matches(r, where)) return r as never;
    return null;
  },
  async list(table, where = {}, opts = {}) {
    let rows = [...tbl(table).values()].filter((r) => matches(r, where));
    const key = opts.orderBy ?? "created_at";
    rows.sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")) * (opts.asc ? 1 : -1));
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows as never;
  },
  async count(table, where = {}) {
    return [...tbl(table).values()].filter((r) => matches(r, where)).length;
  },
};

/* ── Supabase-backed store ─────────────────────────────────────────────── */
let supabase: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!supabase) supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  return supabase;
}

const supabaseStore: Store = {
  async insert(table, data) {
    const { data: row, error } = await client().from(table).insert(data as never).select().single();
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return row as never;
  },
  async update(table, id, data) {
    const { data: row, error } = await client().from(table).update(data as never).eq("id", id).select().single();
    if (error) throw new Error(`${table} update: ${error.message}`);
    return row as never;
  },
  async get(table, id) {
    const { data, error } = await client().from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`${table} get: ${error.message}`);
    return (data as never) ?? null;
  },
  async findOne(table, where) {
    const { data, error } = await client().from(table).select("*").match(where).limit(1).maybeSingle();
    if (error) throw new Error(`${table} findOne: ${error.message}`);
    return (data as never) ?? null;
  },
  async list(table, where = {}, opts = {}) {
    let q = client().from(table).select("*").match(where).order(opts.orderBy ?? "created_at", { ascending: opts.asc ?? false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`${table} list: ${error.message}`);
    return (data ?? []) as never;
  },
  async count(table, where = {}) {
    const { count, error } = await client().from(table).select("id", { count: "exact", head: true }).match(where);
    if (error) throw new Error(`${table} count: ${error.message}`);
    return count ?? 0;
  },
};

export const db: Store = hasSupabase() ? supabaseStore : memoryStore;
export const storeKind = () => (hasSupabase() ? "supabase" : "memory");

/* ── Company bootstrap ─────────────────────────────────────────────────── */
let cachedCompanyId: string | null = null;
export async function companyId(): Promise<string> {
  if (cachedCompanyId) return cachedCompanyId;
  const existing = await db.findOne<Row>("companies", { slug: env.companySlug });
  if (existing) return (cachedCompanyId = existing.id);
  const created = await db.insert<Row>("companies", {
    slug: env.companySlug,
    name: env.companyName,
    phone: env.ownerMobile,
    timezone: env.timezone,
  });
  return (cachedCompanyId = created.id);
}

/* ── Typed helpers used by agents and routes ───────────────────────────── */
export interface Client extends Row { company_id: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; portal_token?: string }
export interface Lead extends Row { company_id: string; client_id?: string | null; name?: string | null; phone?: string | null; email?: string | null; address?: string | null; project_type?: string | null; description?: string | null; budget_range?: string | null; timeline?: string | null; source: string; stage: string; estimated_revenue?: number | null; urgency?: string | null; next_task?: string | null; next_task_due?: string | null; owner_agent?: string | null }
export interface Call extends Row { company_id: string; provider: string; provider_call_id?: string | null; direction: string; from_number?: string | null; to_number?: string | null; caller_name?: string | null; client_id?: string | null; lead_id?: string | null; status: string; handled_by: string; intent?: string | null; outcome?: string | null; extracted: Record<string, unknown>; summary?: string | null; recording_url?: string | null; voicemail_transcript?: string | null; duration_seconds?: number | null; started_at: string; ended_at?: string | null }
export interface CallTurn extends Row { call_id: string; seq: number; speaker: "caller" | "caroline" | "system" | "owner"; text: string; confidence?: number | null }
export interface Message extends Row { company_id: string; channel: string; direction: string; from_address?: string | null; to_address?: string | null; body: string; client_id?: string | null; lead_id?: string | null; sent_by?: string | null; approval_id?: string | null }
export interface Appointment extends Row { company_id: string; kind: string; title: string; starts_at?: string | null; ends_at?: string | null; proposed_windows: unknown[]; location?: string | null; status: string; lead_id?: string | null; client_id?: string | null; zoom_join_url?: string | null; google_event_id?: string | null }
export interface AgentAction extends Row { company_id: string; agent_id: string; action: string; input: unknown; output?: unknown; status: string; trigger_source?: string | null; entity_type?: string | null; entity_id?: string | null }
export interface Approval extends Row { company_id: string; agent_action_id?: string | null; kind: string; summary: string; payload: Record<string, unknown>; status: string; decided_by?: string | null; decided_at?: string | null }
export interface Deliverable extends Row { company_id: string; agent_id: string; kind: string; title: string; format: string; content: string; data: Record<string, unknown>; version: number; status: string; share_token?: string; client_id?: string | null; lead_id?: string | null; project_id?: string | null; client_decision?: string | null }
export interface Estimate extends Row { company_id: string; title: string; scope?: string | null; status: string; labor_rate: number; material_total: number; labor_total: number; equipment_total: number; subcontractor_total: number; overhead_pct: number; total: number; confidence?: number | null; assumptions: unknown[]; exclusions: unknown[]; lead_id?: string | null; client_id?: string | null }

/** Find (or create) the client record for a phone number. */
export async function clientByPhone(phone: string): Promise<Client | null> {
  if (!phone) return null;
  const cid = await companyId();
  return db.findOne<Client>("clients", { company_id: cid, phone: normalizePhone(phone) });
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}
