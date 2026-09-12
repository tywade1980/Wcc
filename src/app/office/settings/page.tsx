import { env, hasAnthropic, hasTwilio, hasZoom, hasGoogle } from "@/lib/env";
import { storeKind } from "@/lib/db";
export const dynamic = "force-dynamic";

export default function Settings() {
  const base = env.baseUrl;
  const rows: [string, boolean, string][] = [
    ["Database (Supabase)", storeKind() === "supabase", "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and run supabase/migrations/0001_platform.sql. Until then data lives in memory and resets on deploy."],
    ["Agents (Anthropic)", hasAnthropic(), "Set ANTHROPIC_API_KEY. Caroline and the staff run on Claude."],
    ["Phone & SMS (Twilio)", hasTwilio(), `Point the number's Voice webhook at ${base}/api/voice/inbound, status callback at ${base}/api/voice/status, and Messaging webhook at ${base}/api/sms/inbound. Forward the 614-359-7218 line to the Twilio number (or port it).`],
    ["Zoom Workplace", hasZoom(), `Server-to-Server OAuth app with scopes meeting:write:admin, phone:read:admin. Event subscription URL ${base}/api/zoom/webhook for phone.* and meeting.* events.`],
    ["Google Calendar", hasGoogle(), "OAuth client + refresh token for Tyler's calendar. Confirmed visits get written there."],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings & wiring</h1>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {rows.map(([name, ok, help]) => (
          <div key={name} className="p-3 text-sm">
            <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-stone-300"}`} /><span className="font-medium">{name}</span><span className="text-xs text-stone-500">{ok ? "connected" : "not configured"}</span></div>
            <div className="text-stone-600 mt-1 break-words">{help}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-3 text-sm space-y-1">
        <div className="font-medium">Company</div>
        <div>{env.companyName} · owner {env.ownerName} · transfers ring {env.ownerMobile || "(OWNER_MOBILE not set)"} · hours in {env.timezone}</div>
        <div className="text-stone-500">Receptionist voice: {env.receptionistVoice}</div>
      </div>
    </div>
  );
}
