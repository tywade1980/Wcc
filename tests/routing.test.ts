import { describe, it, expect } from "vitest";
import { screenNumber, routeIntent, isWithinHours } from "@/lib/telephony/routing";

describe("screenNumber", () => {
  it("sends toll-free origins to voicemail", () => expect(screenNumber("+18005551212")?.action).toBe("voicemail"));
  it("passes normal numbers", () => expect(screenNumber("+16145551212")).toBeNull());
  it("honors block/allow lists", () => {
    expect(screenNumber("+18005551212", { allowed: ["+18005551212"] })).toBeNull();
    expect(screenNumber("+16145551212", { blocked: ["+16145551212"] })?.action).toBe("end");
  });
});

describe("routeIntent", () => {
  it("transfers existing clients during hours when owner is reachable", () => {
    expect(routeIntent("existing_client", { withinHours: true, ownerAvailable: true }).action).toBe("transfer");
    expect(routeIntent("existing_client", { withinHours: false, ownerAvailable: true }).action).toBe("continue");
  });
  it("books new leads and ends spam", () => {
    expect(routeIntent("new_lead", { withinHours: true, ownerAvailable: true }).action).toBe("book");
    expect(routeIntent("spam", { withinHours: true, ownerAvailable: true }).action).toBe("end");
  });
});

describe("isWithinHours", () => {
  it("knows Saturday afternoon is closed and Tuesday 9am is open (Eastern)", () => {
    expect(isWithinHours(new Date("2026-09-12T20:00:00Z"), "America/New_York")).toBe(false); // Sat 4pm ET
    expect(isWithinHours(new Date("2026-09-15T13:00:00Z"), "America/New_York")).toBe(true);  // Tue 9am ET
    expect(isWithinHours(new Date("2026-09-13T15:00:00Z"), "America/New_York")).toBe(false); // Sun
  });
});
