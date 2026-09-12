import { storeKind } from "@/lib/db";
import { hasAnthropic, hasTwilio, hasZoom, hasGoogle } from "@/lib/env";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ ok: true, store: storeKind(), anthropic: hasAnthropic(), twilio: hasTwilio(), zoom: hasZoom(), google: hasGoogle(), time: new Date().toISOString() });
}
