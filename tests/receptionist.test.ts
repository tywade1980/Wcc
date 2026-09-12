import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.SUPABASE_URL;
  process.env.OWNER_MOBILE = "+16145550000";
});

describe("receptionist call flow (memory store, no model)", () => {
  it("logs the call, greets, records turns, and creates a lead from extracted data", async () => {
    const { startCall, nextTurn, finishCall } = await import("@/lib/telephony/receptionist");
    const { db } = await import("@/lib/db");
    const { call, greeting } = await startCall({ callSid: "CA123", from: "614-555-1234", to: "+16143597218" });
    expect(greeting).toContain("Caroline");
    expect(call.from_number).toBe("+16145551234");
    const { turn, call: after } = await nextTurn(call.id, "Hi, I need a quote for a kitchen remodel");
    expect(turn.reply.length).toBeGreaterThan(0);
    expect(after.summary).toBeTruthy();
    const turns = await db.list("call_turns", { call_id: call.id });
    expect(turns.length).toBe(3); // greeting + caller + caroline
    const done = await finishCall(call.id, { status: "completed" });
    expect(done?.ended_at).toBeTruthy();
  });
});

describe("zoom webhook helpers", () => {
  it("answers url validation with an HMAC of the plain token", async () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = "secret";
    const { urlValidationResponse, verifyZoomSignature } = await import("@/lib/integrations/zoom");
    const r = urlValidationResponse("abc");
    expect(r.plainToken).toBe("abc");
    expect(r.encryptedToken).toMatch(/^[a-f0-9]{64}$/);
    const h = new Headers({ "x-zm-request-timestamp": "1", "x-zm-signature": "v0=bad" });
    expect(verifyZoomSignature(h, "{}")).toBe(false);
  });
  it("folds a Zoom voicemail into the calls table", async () => {
    const { ingestZoomPhoneEvent } = await import("@/lib/integrations/zoom");
    const c = await ingestZoomPhoneEvent({ event: "phone.voicemail_received", event_ts: Date.now(), payload: { account_id: "a", object: { id: "vm1", call_id: "c1", caller_number: "6145559999", caller_name: "Pat", download_url: "https://zoom.us/x", duration: 12, date_time: "2026-09-12T10:00:00Z" } } });
    expect(c?.status).toBe("voicemail");
    expect(c?.from_number).toBe("+16145559999");
  });
});

describe("calendar conflicts", () => {
  it("detects overlap", async () => {
    const { detectConflicts } = await import("@/lib/integrations/google-calendar");
    const out = detectConflicts([{ title: "Site visit", start: new Date("2026-09-15T14:00:00Z"), end: new Date("2026-09-15T15:00:00Z") }], [{ summary: "Dentist", start: "2026-09-15T14:30:00Z", end: "2026-09-15T15:30:00Z" }]);
    expect(out.length).toBe(1);
  });
});
