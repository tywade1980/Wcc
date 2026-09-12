/**
 * Call routing rules. Ported from smart-incallservice CallRoutingAgent and the
 * caroline-android screening service, adapted to a one-owner shop.
 */
export type CallerIntent = "new_lead" | "existing_client" | "vendor" | "spam" | "personal" | "billing" | "warranty" | "emergency" | "other";
export type CallAction = "continue" | "book" | "transfer" | "voicemail" | "end";

export interface RoutingDecision {
  action: CallAction;
  reason: string;
  priority: number; // 0-10
  whisper?: string; // what Tyler hears before the bridge
}

const ROBOCALL_PREFIXES = ["+1800", "+1888", "+1877", "+1866", "+1855", "+1844", "+1833", "+1900"];

export function screenNumber(from: string, opts: { blocked?: string[]; allowed?: string[] } = {}): RoutingDecision | null {
  const n = from.replace(/[^\d+]/g, "");
  if (opts.allowed?.includes(n)) return null;
  if (opts.blocked?.includes(n)) return { action: "end", reason: "blocked number", priority: 0 };
  if (!n || n === "anonymous" || n.toLowerCase().includes("unknown")) return { action: "continue", reason: "no caller id; screen by conversation", priority: 2 };
  if (ROBOCALL_PREFIXES.some((p) => n.startsWith(p))) return { action: "voicemail", reason: "toll-free origin; likely robocall", priority: 1 };
  return null;
}

export function routeIntent(intent: CallerIntent, opts: { knownClient?: boolean; withinHours: boolean; ownerAvailable: boolean }): RoutingDecision {
  switch (intent) {
    case "emergency":
      return { action: "transfer", reason: "active-site emergency", priority: 10, whisper: "Urgent site call." };
    case "existing_client":
      return opts.ownerAvailable && opts.withinHours
        ? { action: "transfer", reason: "existing client during hours", priority: 7, whisper: "Existing client on the line." }
        : { action: "continue", reason: "take a message for the owner", priority: 6 };
    case "new_lead":
      return { action: "book", reason: "qualify and propose a site visit", priority: 5 };
    case "billing":
    case "warranty":
      return { action: "continue", reason: "take details, hand to finance/warranties", priority: 4 };
    case "vendor":
      return { action: "continue", reason: "take a message", priority: 3 };
    case "spam":
      return { action: "end", reason: "solicitation", priority: 0 };
    case "personal":
      return opts.ownerAvailable ? { action: "transfer", reason: "personal contact", priority: 6 } : { action: "voicemail", reason: "personal, owner busy", priority: 3 };
    default:
      return { action: "continue", reason: "clarify", priority: 2 };
  }
}

/** Business-hours check in the company timezone. */
export function isWithinHours(date: Date, tz: string, hours: Record<string, [string, string]> = DEFAULT_HOURS): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const day = parts.weekday.toLowerCase().slice(0, 3);
  const window = hours[day];
  if (!window) return false;
  const now = `${parts.hour}:${parts.minute}`;
  return now >= window[0] && now <= window[1];
}

export const DEFAULT_HOURS: Record<string, [string, string]> = {
  mon: ["07:00", "18:00"], tue: ["07:00", "18:00"], wed: ["07:00", "18:00"], thu: ["07:00", "18:00"], fri: ["07:00", "18:00"], sat: ["08:00", "14:00"],
};
