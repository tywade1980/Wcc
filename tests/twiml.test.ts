import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.PLATFORM_BASE_URL = "https://example.test";
  process.env.TWILIO_PHONE_NUMBER = "+16140000000";
});

describe("twiml", () => {
  it("greeting gathers speech and posts to the turn endpoint", async () => {
    const { greetingTwiml } = await import("@/lib/telephony/twiml");
    const x = greetingTwiml("abc", "Hello there");
    expect(x).toContain("<Gather");
    expect(x).toContain('input="speech"');
    expect(x).toContain("https://example.test/api/voice/turn?call=abc");
    expect(x).toContain("Hello there");
  });
  it("transfer dials the owner with a whisper and falls to transfer-status", async () => {
    const { transferTwiml } = await import("@/lib/telephony/twiml");
    const x = transferTwiml("abc", "Connecting you", "+16145550000", "Caller about a kitchen");
    expect(x).toContain("<Dial");
    expect(x).toContain("+16145550000");
    expect(x).toContain("/api/voice/whisper?call=abc");
    expect(x).toContain("/api/voice/transfer-status?call=abc");
  });
  it("voicemail records with transcription", async () => {
    const { voicemailTwiml } = await import("@/lib/telephony/twiml");
    const x = voicemailTwiml("abc");
    expect(x).toContain("<Record");
    expect(x).toContain('transcribe="true"');
  });
});
