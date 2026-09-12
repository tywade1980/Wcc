/** Typed access to environment. Everything optional so previews/tests boot without secrets. */
export const env = {
  baseUrl: (process.env.PLATFORM_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, ""),
  companyName: process.env.COMPANY_NAME ?? "Wade Custom Carpentry",
  companySlug: process.env.COMPANY_SLUG ?? "wcc",
  ownerName: process.env.OWNER_NAME ?? "Tyler Wade",
  ownerMobile: process.env.OWNER_MOBILE ?? "",
  timezone: process.env.BUSINESS_TIMEZONE ?? "America/New_York",

  officePasscode: process.env.OFFICE_PASSCODE ?? "",
  officeSessionSecret: process.env.OFFICE_SESSION_SECRET ?? "",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  agentModel: process.env.AGENT_MODEL ?? "claude-opus-5",
  receptionistModel: process.env.RECEPTIONIST_MODEL ?? "claude-opus-5",

  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  receptionistVoice: process.env.RECEPTIONIST_VOICE ?? "Google.en-US-Chirp3-HD-Aoede",
  twilioSkipSignature: process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true",

  zoomAccountId: process.env.ZOOM_ACCOUNT_ID ?? "",
  zoomClientId: process.env.ZOOM_CLIENT_ID ?? "",
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET ?? "",
  zoomWebhookSecret: process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "",
  zoomHostUser: process.env.ZOOM_HOST_USER ?? "me",

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
} as const;

export const hasSupabase = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);
export const hasAnthropic = () => Boolean(env.anthropicApiKey);
export const hasTwilio = () => Boolean(env.twilioAccountSid && env.twilioAuthToken);
export const hasZoom = () => Boolean(env.zoomAccountId && env.zoomClientId && env.zoomClientSecret);
export const hasGoogle = () => Boolean(env.googleClientId && env.googleClientSecret && env.googleRefreshToken);
