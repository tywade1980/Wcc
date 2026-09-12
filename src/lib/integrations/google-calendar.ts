/**
 * Google Calendar via REST (no googleapis dependency). Ported from
 * rsmeans-mobile-app/server/calendar.ts: create/update/list events and detect
 * conflicts. Uses a refresh token minted once for Tyler's account.
 */
import { env, hasGoogle } from "../env";

let access: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (!hasGoogle()) throw new Error("Google Calendar is not configured");
  if (access && access.expiresAt > Date.now() + 60_000) return access.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, refresh_token: env.googleRefreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`);
  const b = (await res.json()) as { access_token: string; expires_in: number };
  access = { token: b.access_token, expiresAt: Date.now() + b.expires_in * 1000 };
  return access.token;
}

async function gcal<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = await accessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Google Calendar ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export interface CalendarEvent { id?: string; title: string; description?: string; startTime: Date; endTime: Date; location?: string; colorId?: string; extended?: Record<string, string> }
export interface CalendarConflict { event: string; conflictingEvent: string; overlapStart: string; overlapEnd: string }

const calId = () => encodeURIComponent(env.googleCalendarId);

export async function createEvent(e: CalendarEvent): Promise<{ id: string; htmlLink: string }> {
  const body = { summary: e.title, description: e.description ?? "", location: e.location ?? "", start: { dateTime: e.startTime.toISOString(), timeZone: env.timezone }, end: { dateTime: e.endTime.toISOString(), timeZone: env.timezone }, colorId: e.colorId ?? "1", extendedProperties: { private: e.extended ?? {} } };
  const r = await gcal<{ id: string; htmlLink: string }>(`/calendars/${calId()}/events`, { method: "POST", body: JSON.stringify(body) });
  return { id: r.id, htmlLink: r.htmlLink };
}

export async function updateEvent(eventId: string, e: Partial<CalendarEvent>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (e.title) patch.summary = e.title;
  if (e.description !== undefined) patch.description = e.description;
  if (e.location !== undefined) patch.location = e.location;
  if (e.startTime) patch.start = { dateTime: e.startTime.toISOString(), timeZone: env.timezone };
  if (e.endTime) patch.end = { dateTime: e.endTime.toISOString(), timeZone: env.timezone };
  await gcal(`/calendars/${calId()}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteEvent(eventId: string): Promise<void> {
  const t = await accessToken();
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId()}/events/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } });
}

export async function listEvents(from: Date, to: Date): Promise<{ id: string; summary: string; start: string; end: string; location?: string }[]> {
  const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const r = await gcal<{ items?: { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; location?: string }[] }>(`/calendars/${calId()}/events?${q}`);
  return (r.items ?? []).map((i) => ({ id: i.id, summary: i.summary ?? "(no title)", start: i.start.dateTime ?? i.start.date ?? "", end: i.end.dateTime ?? i.end.date ?? "", location: i.location }));
}

/** Pure conflict detection so it can be unit tested without Google. */
export function detectConflicts(proposed: { title: string; start: Date; end: Date }[], existing: { summary: string; start: string; end: string }[]): CalendarConflict[] {
  const out: CalendarConflict[] = [];
  for (const p of proposed) for (const e of existing) {
    const es = new Date(e.start).getTime(), ee = new Date(e.end).getTime();
    const os = Math.max(p.start.getTime(), es), oe = Math.min(p.end.getTime(), ee);
    if (os < oe) out.push({ event: p.title, conflictingEvent: e.summary, overlapStart: new Date(os).toISOString(), overlapEnd: new Date(oe).toISOString() });
  }
  return out;
}
