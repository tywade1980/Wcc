/**
 * Zoom Workplace integration.
 *  - Server-to-Server OAuth (account_credentials grant) for API calls.
 *  - Meetings: create a client consultation and get the join link.
 *  - Zoom Phone webhooks: missed calls, voicemails, recordings flow into the
 *    same calls table as Twilio, so the office sees one inbox regardless of
 *    which number the client dialed.
 *  - Webhook URL validation + signature verification per Zoom's spec.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, hasZoom } from "../env";
import { db, companyId, normalizePhone, type Call, type Appointment } from "../db";

let token: { value: string; expiresAt: number } | null = null;

export async function zoomAccessToken(): Promise<string> {
  if (!hasZoom()) throw new Error("Zoom is not configured");
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${env.zoomClientId}:${env.zoomClientSecret}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.zoomAccountId)}`, { method: "POST", headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) throw new Error(`Zoom token: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function zoomApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = await zoomAccessToken();
  const res = await fetch(`https://api.zoom.us/v2${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Zoom ${path}: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? ({} as T) : ((await res.json()) as T));
}

export interface ZoomMeeting { id: number; join_url: string; start_url: string; password?: string; start_time: string; duration: number; topic: string }

/** Create a scheduled consultation meeting. startTime ISO 8601; duration minutes. */
export async function createConsultMeeting(opts: { topic: string; startTime: string; durationMinutes?: number; agenda?: string; timezone?: string }): Promise<ZoomMeeting> {
  return zoomApi<ZoomMeeting>(`/users/${encodeURIComponent(env.zoomHostUser)}/meetings`, {
    method: "POST",
    body: JSON.stringify({
      topic: opts.topic,
      type: 2,
      start_time: opts.startTime,
      duration: opts.durationMinutes ?? 30,
      timezone: opts.timezone ?? env.timezone,
      agenda: opts.agenda ?? "",
      settings: { join_before_host: false, waiting_room: true, auto_recording: "cloud", approval_type: 2 },
    }),
  });
}

/** Attach a Zoom meeting to a confirmed appointment and return the join link. */
export async function attachZoomToAppointment(appointmentId: string): Promise<Appointment> {
  const appt = await db.get<Appointment>("appointments", appointmentId);
  if (!appt?.starts_at) throw new Error("appointment must have starts_at");
  const mins = appt.ends_at ? Math.max(15, Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000)) : 30;
  const m = await createConsultMeeting({ topic: appt.title, startTime: appt.starts_at, durationMinutes: mins });
  return db.update<Appointment>("appointments", appointmentId, { zoom_meeting_id: String(m.id), zoom_join_url: m.join_url, kind: "zoom_consult" });
}

/* ── Webhooks ──────────────────────────────────────────────────────────── */

export function verifyZoomSignature(headers: Headers, rawBody: string): boolean {
  if (!env.zoomWebhookSecret) return false;
  const ts = headers.get("x-zm-request-timestamp") ?? "";
  const sig = headers.get("x-zm-signature") ?? "";
  const expected = `v0=${createHmac("sha256", env.zoomWebhookSecret).update(`v0:${ts}:${rawBody}`).digest("hex")}`;
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/** Zoom's endpoint.url_validation challenge. */
export function urlValidationResponse(plainToken: string) {
  return { plainToken, encryptedToken: createHmac("sha256", env.zoomWebhookSecret).update(plainToken).digest("hex") };
}

interface ZoomPhoneEvent { event: string; event_ts: number; payload: { account_id: string; object: Record<string, unknown> } }

/** Fold Zoom Phone events into the unified calls table. Returns the affected call (if any). */
export async function ingestZoomPhoneEvent(evt: ZoomPhoneEvent): Promise<Call | null> {
  const cid = await companyId();
  await db.insert("integration_events", { company_id: cid, provider: "zoom", event_type: evt.event, provider_event_id: String((evt.payload.object as { call_id?: string; id?: string }).call_id ?? (evt.payload.object as { id?: string }).id ?? evt.event_ts), payload: evt as never, processed: true } as never);
  const o = evt.payload.object as Record<string, unknown> & { caller?: { phone_number?: string; name?: string }; callee?: { phone_number?: string } };

  if (evt.event === "phone.callee_missed" || evt.event === "phone.callee_ended" || evt.event === "phone.callee_answered") {
    const providerId = String(o.call_id ?? "");
    const existing = providerId ? await db.findOne<Call>("calls", { provider_call_id: providerId }) : null;
    const patch: Partial<Call> = {
      status: evt.event === "phone.callee_missed" ? "missed" : evt.event === "phone.callee_answered" ? "in_progress" : "completed",
      handled_by: "owner",
      ended_at: evt.event !== "phone.callee_answered" ? new Date(evt.event_ts).toISOString() : null,
    };
    if (existing) return db.update<Call>("calls", existing.id, patch);
    return db.insert<Call>("calls", { company_id: cid, provider: "zoom", provider_call_id: providerId || null, direction: "inbound", from_number: o.caller?.phone_number ? normalizePhone(o.caller.phone_number) : null, to_number: o.callee?.phone_number ? normalizePhone(o.callee.phone_number) : null, caller_name: o.caller?.name ?? null, extracted: {}, started_at: String(o.ringing_start_time ?? new Date(evt.event_ts).toISOString()), ...patch } as Partial<Call>);
  }

  if (evt.event === "phone.voicemail_received") {
    const v = o as { id?: string; call_id?: string; caller_number?: string; caller_name?: string; download_url?: string; duration?: number; date_time?: string };
    return db.insert<Call>("calls", { company_id: cid, provider: "zoom", provider_call_id: v.call_id ? `${v.call_id}:vm` : `zoom-vm-${v.id}`, direction: "inbound", from_number: v.caller_number ? normalizePhone(v.caller_number) : null, caller_name: v.caller_name ?? null, status: "voicemail", handled_by: "zoom", outcome: "message_taken", recording_url: v.download_url ?? null, duration_seconds: v.duration ?? null, extracted: {}, summary: "Zoom voicemail received", started_at: v.date_time ?? new Date(evt.event_ts).toISOString(), ended_at: new Date(evt.event_ts).toISOString() } as Partial<Call>);
  }

  if (evt.event === "phone.recording_completed") {
    const recs = (o as { recordings?: { id: string; caller_number: string; callee_number: string; duration: number; download_url: string; date_time: string; direction: string }[] }).recordings ?? [];
    let last: Call | null = null;
    for (const r of recs) {
      const existing = await db.findOne<Call>("calls", { provider_call_id: r.id });
      last = existing ? await db.update<Call>("calls", existing.id, { recording_url: r.download_url, duration_seconds: r.duration }) : await db.insert<Call>("calls", { company_id: cid, provider: "zoom", provider_call_id: r.id, direction: r.direction === "outbound" ? "outbound" : "inbound", from_number: normalizePhone(r.caller_number), to_number: normalizePhone(r.callee_number), status: "completed", handled_by: "owner", recording_url: r.download_url, duration_seconds: r.duration, extracted: {}, started_at: r.date_time } as Partial<Call>);
    }
    return last;
  }
  return null;
}
