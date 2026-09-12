/**
 * Platform tools the agents call. Every call writes an agent_actions row so
 * the office shows who did what, from what input. Client-facing outputs go
 * through an approval instead of executing directly.
 */
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db, companyId, normalizePhone, clientByPhone, type Lead, type Call, type Appointment, type Deliverable, type Estimate, type Approval, type AgentAction } from "../db";
import { baselineFromTaxonomy, priceLineItem, totals, proposalMarkdown, type LineItemInput } from "../domain/estimating";
import { env } from "../env";
import type { AgentId } from "./registry";

export interface ToolContext {
  agentId: AgentId;
  triggerSource: string; // call:<sid> | sms:<sid> | chat:<session> | zoom:<id>
  callId?: string;
  leadId?: string;
  clientId?: string;
}

async function logAction(ctx: ToolContext, action: string, input: unknown, output: unknown, extra: Partial<AgentAction> = {}) {
  const cid = await companyId();
  return db.insert<AgentAction>("agent_actions", { company_id: cid, agent_id: ctx.agentId, action, input: input as never, output: output as never, status: "done", trigger_source: ctx.triggerSource, ...extra });
}

const json = (v: unknown) => JSON.stringify(v);

/** Build the tool set for one agent invocation. Only tools the agent is allowed to use are returned. */
export function buildTools(ctx: ToolContext, allowed: string[]) {
  const all = {
    lookup_caller: betaZodTool({
      name: "lookup_caller",
      description: "Look up a phone number in clients and leads. Use at the start of a call so you can greet a known client by name and know their open project.",
      inputSchema: z.object({ phone: z.string() }),
      run: async ({ phone }) => {
        const cid = await companyId();
        const p = normalizePhone(phone);
        const client = await clientByPhone(p);
        const lead = await db.findOne<Lead>("leads", { company_id: cid, phone: p });
        const recent = (await db.list<Call>("calls", { company_id: cid, from_number: p }, { limit: 3 })).map((c) => ({ started_at: c.started_at, intent: c.intent, summary: c.summary }));
        const out = { known: Boolean(client || lead), client, lead, recent_calls: recent };
        await logAction(ctx, "lookup_caller", { phone: p }, { known: out.known });
        return json(out);
      },
    }),

    lookup_lead: betaZodTool({
      name: "lookup_lead",
      description: "Fetch a lead (and its client) by id, or search by name/phone.",
      inputSchema: z.object({ lead_id: z.string().optional(), phone: z.string().optional(), name: z.string().optional() }),
      run: async (input) => {
        const cid = await companyId();
        let lead: Lead | null = null;
        if (input.lead_id) lead = await db.get<Lead>("leads", input.lead_id);
        else if (input.phone) lead = await db.findOne<Lead>("leads", { company_id: cid, phone: normalizePhone(input.phone) });
        else if (input.name) lead = (await db.list<Lead>("leads", { company_id: cid })).find((l) => (l.name ?? "").toLowerCase().includes(input.name!.toLowerCase())) ?? null;
        return json(lead ?? { error: "not found" });
      },
    }),

    create_or_update_lead: betaZodTool({
      name: "create_or_update_lead",
      description: "Create a lead from what the caller/texter told you, or update the one already attached to this conversation. Call it as soon as you have a name or project type; call again as you learn more.",
      inputSchema: z.object({
        name: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        project_type: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        budget_range: z.string().nullable().optional(),
        timeline: z.string().nullable().optional(),
        urgency: z.enum(["flexible", "within_30_days", "asap"]).nullable().optional(),
        estimated_revenue: z.number().nullable().optional(),
        stage: z.enum(["new", "connected", "followed_up", "meeting_scheduled", "estimate_sent", "won", "lost"]).optional(),
        source: z.enum(["website", "phone", "sms", "zoom", "email", "referral", "manual", "other"]).optional(),
      }),
      run: async (input) => {
        const cid = await companyId();
        const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null && v !== ""));
        if (typeof clean.phone === "string") clean.phone = normalizePhone(clean.phone);
        let lead: Lead;
        if (ctx.leadId) lead = await db.update<Lead>("leads", ctx.leadId, clean as Partial<Lead>);
        else {
          lead = await db.insert<Lead>("leads", { company_id: cid, source: ctx.triggerSource.startsWith("sms") ? "sms" : ctx.triggerSource.startsWith("call") ? "phone" : "manual", stage: "new", owner_agent: ctx.agentId, ...clean } as Partial<Lead>);
          ctx.leadId = lead.id;
          if (ctx.callId) await db.update<Call>("calls", ctx.callId, { lead_id: lead.id });
        }
        await logAction(ctx, "create_or_update_lead", clean, { lead_id: lead.id }, { entity_type: "lead", entity_id: lead.id });
        return json({ lead_id: lead.id, stage: lead.stage });
      },
    }),

    list_leads: betaZodTool({
      name: "list_leads",
      description: "List recent leads, optionally by stage.",
      inputSchema: z.object({ stage: z.string().optional(), limit: z.number().optional() }),
      run: async ({ stage, limit }) => {
        const cid = await companyId();
        const rows = await db.list<Lead>("leads", stage ? { company_id: cid, stage } : { company_id: cid }, { limit: limit ?? 25 });
        return json(rows.map((l) => ({ id: l.id, name: l.name, phone: l.phone, project_type: l.project_type, stage: l.stage, created_at: l.created_at, next_task: l.next_task, estimated_revenue: l.estimated_revenue })));
      },
    }),

    list_calls: betaZodTool({
      name: "list_calls",
      description: "Recent calls with intent, outcome, and summary.",
      inputSchema: z.object({ limit: z.number().optional() }),
      run: async ({ limit }) => {
        const cid = await companyId();
        const rows = await db.list<Call>("calls", { company_id: cid }, { limit: limit ?? 20, orderBy: "started_at" });
        return json(rows.map((c) => ({ id: c.id, started_at: c.started_at, from: c.from_number, caller_name: c.caller_name, status: c.status, intent: c.intent, outcome: c.outcome, summary: c.summary })));
      },
    }),

    list_appointments: betaZodTool({
      name: "list_appointments",
      description: "Upcoming and proposed appointments.",
      inputSchema: z.object({ status: z.string().optional() }),
      run: async ({ status }) => {
        const cid = await companyId();
        const rows = await db.list<Appointment>("appointments", status ? { company_id: cid, status } : { company_id: cid }, { limit: 50 });
        return json(rows);
      },
    }),

    list_invoices: betaZodTool({
      name: "list_invoices",
      description: "Invoices with status and balance.",
      inputSchema: z.object({ status: z.string().optional() }),
      run: async ({ status }) => {
        const cid = await companyId();
        return json(await db.list("invoices", status ? { company_id: cid, status } : { company_id: cid }, { limit: 50 }));
      },
    }),

    get_today: betaZodTool({
      name: "get_today",
      description: "Snapshot for the day: new leads, calls to return, approvals pending, appointments today.",
      inputSchema: z.object({}),
      run: async () => {
        const cid = await companyId();
        const today = new Date().toISOString().slice(0, 10);
        const [newLeads, calls, approvals, appts] = await Promise.all([
          db.list<Lead>("leads", { company_id: cid, stage: "new" }, { limit: 20 }),
          db.list<Call>("calls", { company_id: cid }, { limit: 20, orderBy: "started_at" }),
          db.list<Approval>("approvals", { company_id: cid, status: "pending" }, { limit: 20 }),
          db.list<Appointment>("appointments", { company_id: cid }, { limit: 50 }),
        ]);
        return json({
          date: today,
          timezone: env.timezone,
          new_leads: newLeads.map((l) => ({ id: l.id, name: l.name, project_type: l.project_type, phone: l.phone })),
          calls_needing_follow_up: calls.filter((c) => ["voicemail", "missed"].includes(c.status) || c.outcome === "message_taken").map((c) => ({ id: c.id, from: c.from_number, summary: c.summary })),
          approvals_pending: approvals.map((a) => ({ id: a.id, kind: a.kind, summary: a.summary })),
          appointments_today: appts.filter((a) => (a.starts_at ?? "").startsWith(today)),
          proposed_appointments: appts.filter((a) => a.status === "proposed").map((a) => ({ id: a.id, title: a.title, windows: a.proposed_windows })),
        });
      },
    }),

    propose_appointment: betaZodTool({
      name: "propose_appointment",
      description: "Record the caller's preferred windows for a site visit, call, or Zoom consult. Tyler confirms it from the office; do not promise a fixed time.",
      inputSchema: z.object({
        kind: z.enum(["site_visit", "phone_call", "zoom_consult", "follow_up"]).default("site_visit"),
        title: z.string(),
        preferred_windows: z.array(z.string()).describe("Natural-language or ISO windows the caller gave, e.g. 'Tuesday after 3pm'"),
        location: z.string().nullable().optional(),
      }),
      run: async (input) => {
        const cid = await companyId();
        const appt = await db.insert<Appointment>("appointments", { company_id: cid, kind: input.kind, title: input.title, proposed_windows: input.preferred_windows, location: input.location ?? null, status: "proposed", lead_id: ctx.leadId ?? null, client_id: ctx.clientId ?? null, created_by: ctx.agentId });
        if (ctx.leadId) await db.update<Lead>("leads", ctx.leadId, { stage: "meeting_scheduled", next_task: `Confirm ${input.kind.replace("_", " ")}: ${input.preferred_windows.join(" / ")}` });
        await logAction(ctx, "propose_appointment", input, { appointment_id: appt.id }, { entity_type: "appointment", entity_id: appt.id });
        return json({ appointment_id: appt.id, status: "proposed" });
      },
    }),

    log_call_note: betaZodTool({
      name: "log_call_note",
      description: "Attach intent, outcome, and a one-line summary to the current call. Call it before the call ends.",
      inputSchema: z.object({
        intent: z.enum(["new_lead", "existing_client", "vendor", "spam", "personal", "billing", "warranty", "other"]),
        outcome: z.enum(["booked", "transferred", "message_taken", "spam", "info", "other"]),
        summary: z.string(),
      }),
      run: async (input) => {
        if (ctx.callId) await db.update<Call>("calls", ctx.callId, { intent: input.intent, outcome: input.outcome, summary: input.summary });
        await logAction(ctx, "log_call_note", input, { call_id: ctx.callId }, { entity_type: "call", entity_id: ctx.callId });
        return json({ ok: true });
      },
    }),

    draft_client_message: betaZodTool({
      name: "draft_client_message",
      description: "Draft an SMS or email to a client. It is queued for Tyler's approval; nothing is sent until he taps approve.",
      inputSchema: z.object({ channel: z.enum(["sms", "email"]), to: z.string(), body: z.string(), subject: z.string().optional() }),
      run: async (input) => {
        const cid = await companyId();
        const action = await logAction(ctx, "draft_client_message", input, null, { status: "pending_approval", entity_type: "message" });
        const approval = await db.insert<Approval>("approvals", { company_id: cid, agent_action_id: action.id, kind: "send_message", summary: `${input.channel.toUpperCase()} to ${input.to}: ${input.body.slice(0, 80)}`, payload: { ...input, lead_id: ctx.leadId ?? null, client_id: ctx.clientId ?? null }, status: "pending" });
        return json({ approval_id: approval.id, status: "pending_approval" });
      },
    }),

    request_approval: betaZodTool({
      name: "request_approval",
      description: "Ask Tyler to approve a client-facing action (send estimate, share board, confirm booking, send invoice). Returns an approval id.",
      inputSchema: z.object({ kind: z.string(), summary: z.string(), payload: z.record(z.string(), z.unknown()).default({}) }),
      run: async (input) => {
        const cid = await companyId();
        const action = await logAction(ctx, "request_approval", input, null, { status: "pending_approval" });
        const approval = await db.insert<Approval>("approvals", { company_id: cid, agent_action_id: action.id, kind: input.kind, summary: input.summary, payload: input.payload as Record<string, unknown>, status: "pending" });
        return json({ approval_id: approval.id });
      },
    }),

    create_task: betaZodTool({
      name: "create_task",
      description: "Create a task for Tyler or an agent, attached to a lead or project when known.",
      inputSchema: z.object({ title: z.string(), due: z.string().nullable().optional(), assignee: z.string().default("tyler"), notes: z.string().nullable().optional() }),
      run: async (input) => {
        const cid = await companyId();
        const task = await db.insert("tasks", { company_id: cid, ...input, status: "open", lead_id: ctx.leadId ?? null, created_by: ctx.agentId } as never);
        if (ctx.leadId) await db.update<Lead>("leads", ctx.leadId, { next_task: input.title, next_task_due: input.due ?? null });
        await logAction(ctx, "create_task", input, { task_id: task.id }, { entity_type: "task", entity_id: task.id });
        return json({ task_id: task.id });
      },
    }),

    create_daily_log: betaZodTool({
      name: "create_daily_log",
      description: "Write a structured daily log from a field voice note.",
      inputSchema: z.object({ project_id: z.string().nullable().optional(), log_date: z.string().optional(), phase: z.string().nullable().optional(), work_performed: z.string(), hours_worked: z.number().nullable().optional(), materials_used: z.string().nullable().optional(), issues: z.string().nullable().optional(), tomorrow_plan: z.string().nullable().optional(), raw_voice_note: z.string().nullable().optional() }),
      run: async (input) => {
        const cid = await companyId();
        const log = await db.insert("daily_logs", { company_id: cid, created_by: ctx.agentId, ...input } as never);
        await logAction(ctx, "create_daily_log", input, { daily_log_id: log.id }, { entity_type: "daily_log", entity_id: log.id });
        return json({ daily_log_id: log.id });
      },
    }),

    baseline_estimate: betaZodTool({
      name: "baseline_estimate",
      description: "Get the assembly-taxonomy baseline line items and totals for a project type (kitchen remodel, bathroom remodel, trim carpentry, built-ins, flooring, addition). Adjust from here.",
      inputSchema: z.object({ project_type: z.string(), labor_rate: z.number().optional(), complexity_multiplier: z.number().optional() }),
      run: async ({ project_type, labor_rate, complexity_multiplier }) => json(baselineFromTaxonomy(project_type, labor_rate, complexity_multiplier)),
    }),

    price_line_items: betaZodTool({
      name: "price_line_items",
      description: "Price a list of line items (labor hours × rate + materials + equipment + subs) and return totals with overhead.",
      inputSchema: z.object({
        items: z.array(z.object({ phase: z.string().optional(), name: z.string(), description: z.string().optional(), quantity: z.number().optional(), unit: z.string().optional(), laborHours: z.number().optional(), materialCost: z.number().optional(), equipmentCost: z.number().optional(), subcontractorCost: z.number().optional(), csiDivision: z.string().optional(), rsmeansReference: z.string().optional() })),
        labor_rate: z.number().optional(),
        overhead_pct: z.number().optional(),
      }),
      run: async ({ items, labor_rate, overhead_pct }) => {
        const priced = (items as LineItemInput[]).map((i) => priceLineItem(i, labor_rate));
        return json({ items: priced, totals: totals(priced, overhead_pct) });
      },
    }),

    create_estimate: betaZodTool({
      name: "create_estimate",
      description: "Persist an estimate with its line items and produce the client-ready proposal deliverable. Returns estimate_id and deliverable_id.",
      inputSchema: z.object({
        title: z.string(),
        client_name: z.string(),
        project_type: z.string(),
        scope: z.string(),
        location: z.string().nullable().optional(),
        labor_rate: z.number().optional(),
        overhead_pct: z.number().optional(),
        confidence: z.number().min(0).max(100),
        assumptions: z.array(z.string()).default([]),
        exclusions: z.array(z.string()).default([]),
        items: z.array(z.object({ phase: z.string().optional(), name: z.string(), description: z.string().optional(), quantity: z.number().optional(), unit: z.string().optional(), laborHours: z.number().optional(), materialCost: z.number().optional(), equipmentCost: z.number().optional(), subcontractorCost: z.number().optional(), csiDivision: z.string().optional(), rsmeansReference: z.string().optional() })),
      }),
      run: async (input) => {
        const cid = await companyId();
        const rate = input.labor_rate ?? 85;
        const priced = (input.items as LineItemInput[]).map((i) => priceLineItem(i, rate));
        const t = totals(priced, input.overhead_pct ?? 20);
        const est = await db.insert<Estimate>("estimates", { company_id: cid, title: input.title, scope: input.scope, status: "draft", labor_rate: rate, material_total: t.materialTotal, labor_total: t.laborTotal, equipment_total: t.equipmentTotal, subcontractor_total: t.subcontractorTotal, overhead_pct: t.overheadPct, total: t.total, confidence: input.confidence, assumptions: input.assumptions, exclusions: input.exclusions, lead_id: ctx.leadId ?? null, client_id: ctx.clientId ?? null, created_by: ctx.agentId } as Partial<Estimate>);
        for (const [i, li] of priced.entries()) await db.insert("estimate_line_items", { estimate_id: est.id, seq: i, phase: li.phase, name: li.name, description: li.description, quantity: li.quantity, unit: li.unit, labor_hours: li.laborHours, material_cost: li.materialCost, labor_cost: li.laborCost, equipment_cost: li.equipmentCost, subcontractor_cost: li.subcontractorCost, total: li.total, csi_division: li.csiDivision, rsmeans_reference: li.rsmeansReference } as never);
        const md = proposalMarkdown({ company: env.companyName, client: input.client_name, projectType: input.project_type, location: input.location ?? undefined, items: priced, totals: t, laborRate: rate, assumptions: input.assumptions, exclusions: input.exclusions });
        const deliverable = await db.insert<Deliverable>("deliverables", { company_id: cid, agent_id: ctx.agentId, kind: "proposal", title: `${input.title} — Proposal`, format: "markdown", content: md, data: { estimate_id: est.id, totals: t, items: priced, confidence: input.confidence }, version: 1, status: "draft", lead_id: ctx.leadId ?? null, client_id: ctx.clientId ?? null });
        await logAction(ctx, "create_estimate", { title: input.title, total: t.total, confidence: input.confidence }, { estimate_id: est.id, deliverable_id: deliverable.id }, { entity_type: "estimate", entity_id: est.id });
        return json({ estimate_id: est.id, deliverable_id: deliverable.id, totals: t });
      },
    }),

    create_invoice_from_estimate: betaZodTool({
      name: "create_invoice_from_estimate",
      description: "Create a draft invoice from an approved estimate (deposit, progress, or final) as a percentage or fixed amount. Sending requires approval.",
      inputSchema: z.object({ estimate_id: z.string(), type: z.enum(["RETAINER", "PROGRESS", "FINAL", "STANDARD"]).default("STANDARD"), percent: z.number().optional(), amount: z.number().optional(), due_in_days: z.number().default(7) }),
      run: async (input) => {
        const cid = await companyId();
        const est = await db.get<Estimate>("estimates", input.estimate_id);
        if (!est) return json({ error: "estimate not found" });
        const amount = input.amount ?? Math.round(Number(est.total) * ((input.percent ?? 100) / 100) * 100) / 100;
        const due = new Date(Date.now() + input.due_in_days * 86400000).toISOString().slice(0, 10);
        const inv = await db.insert("invoices", { company_id: cid, estimate_id: est.id, client_id: est.client_id ?? null, type: input.type, status: "DRAFT", due_date: due, subtotal: amount, total: amount, line_items: [{ name: `${input.type} — ${est.title}`, total: amount }] } as never);
        await logAction(ctx, "create_invoice_from_estimate", input, { invoice_id: inv.id, amount }, { entity_type: "invoice", entity_id: inv.id });
        return json({ invoice_id: inv.id, amount, due_date: due, status: "DRAFT" });
      },
    }),

    record_payment: betaZodTool({
      name: "record_payment",
      description: "Record a payment against an invoice (Zelle, check, cash, card, ACH).",
      inputSchema: z.object({ invoice_id: z.string(), amount: z.number(), method: z.enum(["CASH", "CHECK", "CREDIT_CARD", "ACH", "ZELLE", "OTHER"]), reference: z.string().optional() }),
      run: async (input) => {
        const cid = await companyId();
        const pay = await db.insert("payments", { company_id: cid, ...input } as never);
        const inv = await db.get<{ id: string; amount_paid: number; total: number }>("invoices", input.invoice_id);
        if (inv) {
          const paid = Number(inv.amount_paid ?? 0) + input.amount;
          await db.update("invoices", inv.id, { amount_paid: paid, status: paid >= Number(inv.total) ? "PAID" : "PARTIAL_PAID" } as never);
        }
        await logAction(ctx, "record_payment", input, { payment_id: pay.id }, { entity_type: "payment", entity_id: pay.id });
        return json({ payment_id: pay.id });
      },
    }),

    create_deliverable: betaZodTool({
      name: "create_deliverable",
      description: "Save an output Tyler (and optionally a client) will open, edit, and approve: proposal, drawing (svg), mood board (html/markdown), report, plan (markdown or json).",
      inputSchema: z.object({ kind: z.string(), title: z.string(), format: z.enum(["markdown", "json", "html", "svg"]).default("markdown"), content: z.string(), data: z.record(z.string(), z.unknown()).default({}) }),
      run: async (input) => {
        const cid = await companyId();
        const d = await db.insert<Deliverable>("deliverables", { company_id: cid, agent_id: ctx.agentId, kind: input.kind, title: input.title, format: input.format, content: input.content, data: input.data as Record<string, unknown>, version: 1, status: "draft", lead_id: ctx.leadId ?? null, client_id: ctx.clientId ?? null });
        await logAction(ctx, "create_deliverable", { kind: input.kind, title: input.title, format: input.format }, { deliverable_id: d.id }, { entity_type: "deliverable", entity_id: d.id });
        return json({ deliverable_id: d.id, url: `${env.baseUrl}/office/deliverables/${d.id}` });
      },
    }),

    handoff: betaZodTool({
      name: "handoff",
      description: "Hand work to another agent. The platform queues it for that agent and shows it in the office.",
      inputSchema: z.object({ to_agent: z.string(), reason: z.string(), priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"), context: z.string(), action_requested: z.string() }),
      run: async (input) => {
        const cid = await companyId();
        const a = await db.insert("handoffs", { company_id: cid, from_agent: ctx.agentId, ...input, status: "queued", lead_id: ctx.leadId ?? null } as never);
        await logAction(ctx, "handoff", input, { handoff_id: a.id }, { entity_type: "handoff", entity_id: a.id });
        return json({ handoff_id: a.id, status: "queued" });
      },
    }),
  };

  return allowed.filter((n) => n in all).map((n) => all[n as keyof typeof all]);
}

export type PlatformTools = ReturnType<typeof buildTools>;
