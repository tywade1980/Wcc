/**
 * TwiML builders. Twilio drives the call; each webhook returns the next
 * instruction. The receptionist loop is <Gather input="speech"> → Claude →
 * <Say> → <Gather>, which runs on plain HTTP (Vercel-friendly, no WebSocket).
 * ConversationRelay (streaming, lower latency) is offered as an alternative
 * for a WebSocket host; see conversationRelayTwiml().
 */
import twilio from "twilio";
import { env } from "../env";

const VoiceResponse = twilio.twiml.VoiceResponse;
type SayVoice = Parameters<InstanceType<typeof VoiceResponse>["say"]>[0] extends infer A ? (A extends { voice?: infer V } ? V : never) : never;
const voice = () => env.receptionistVoice as SayVoice;
const url = (path: string) => `${env.baseUrl}${path}`;

export function greetingTwiml(callId: string, greeting: string): string {
  const r = new VoiceResponse();
  const g = r.gather({ input: ["speech"], action: url(`/api/voice/turn?call=${callId}`), method: "POST", speechTimeout: "auto", speechModel: "phone_call", enhanced: true, language: "en-US", actionOnEmptyResult: true });
  g.say({ voice: voice() }, greeting);
  return r.toString();
}

export function replyAndListenTwiml(callId: string, reply: string): string {
  const r = new VoiceResponse();
  const g = r.gather({ input: ["speech"], action: url(`/api/voice/turn?call=${callId}`), method: "POST", speechTimeout: "auto", speechModel: "phone_call", enhanced: true, language: "en-US", actionOnEmptyResult: true });
  g.say({ voice: voice() }, reply);
  return r.toString();
}

export function repromptTwiml(callId: string, text = "Sorry, I didn't catch that. Could you say that again?"): string {
  return replyAndListenTwiml(callId, text);
}

/** Bridge to the owner. If unanswered, fall to voicemail. Owner hears a whisper first and can press any key to accept. */
export function transferTwiml(callId: string, sayFirst: string, ownerNumber: string, whisper: string): string {
  const r = new VoiceResponse();
  r.say({ voice: voice() }, sayFirst);
  const d = r.dial({ action: url(`/api/voice/transfer-status?call=${callId}`), method: "POST", timeout: 20, callerId: env.twilioPhoneNumber || undefined, answerOnBridge: true });
  d.number({ url: url(`/api/voice/whisper?call=${callId}&text=${encodeURIComponent(whisper)}`), method: "POST" }, ownerNumber);
  return r.toString();
}

/** Played to the owner's phone before the bridge; a key press accepts. */
export function whisperTwiml(text: string): string {
  const r = new VoiceResponse();
  const g = r.gather({ numDigits: 1, timeout: 5 });
  g.say({ voice: voice() }, `${text} Press any key to accept.`);
  r.hangup();
  return r.toString();
}

export function voicemailTwiml(callId: string, prompt = "Please leave your name, number, and a brief message after the tone, and we'll call you back within one business day."): string {
  const r = new VoiceResponse();
  r.say({ voice: voice() }, prompt);
  r.record({ maxLength: 180, playBeep: true, action: url(`/api/voice/voicemail?call=${callId}`), method: "POST", transcribe: true, transcribeCallback: url(`/api/voice/voicemail?call=${callId}&transcription=1`) });
  r.say({ voice: voice() }, "Thank you. Goodbye.");
  r.hangup();
  return r.toString();
}

export function goodbyeTwiml(text: string): string {
  const r = new VoiceResponse();
  r.say({ voice: voice() }, text);
  r.hangup();
  return r.toString();
}

export function rejectTwiml(): string {
  const r = new VoiceResponse();
  r.reject({ reason: "rejected" });
  return r.toString();
}

/** Alternative low-latency path for hosts that support WebSockets. */
export function conversationRelayTwiml(callId: string, wsUrl: string, greeting: string): string {
  const r = new VoiceResponse();
  const c = r.connect({ action: url(`/api/voice/status?call=${callId}&relay=1`) });
  const relay = c.conversationRelay({ url: wsUrl, welcomeGreeting: greeting, ttsProvider: "Google", voice: env.receptionistVoice.replace(/^Google\./, "") });
  relay.parameter({ name: "callId", value: callId });
  return r.toString();
}

export const xml = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
