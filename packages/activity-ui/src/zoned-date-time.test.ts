import { afterEach, describe, expect, it } from "vitest";
import { formatZonedDateTime, fromZonedDateTimeInput, isZonedMidnight, toZonedDateTimeInput } from "./zoned-date-time";
const originalZone = process.env.TZ;
afterEach(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });
describe("configured timezone conversion", () => {
  it.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])("ignores device timezone %s for display and entry", (zone) => {
    process.env.TZ = zone;
    const instant = "2026-10-21T17:14:08Z";
    expect(toZonedDateTimeInput(instant, "America/Toronto")).toBe("2026-10-21T13:14");
    expect(fromZonedDateTimeInput("2026-10-21T13:14", "America/Toronto")).toBe("2026-10-21T17:14:00.000Z");
    expect(formatZonedDateTime(instant, "America/Toronto", "en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })).toBe("13:14");
    expect(isZonedMidnight("2026-10-22T04:00:00Z", "America/Toronto")).toBe(true);
  });
  it("uses seasonal offsets and standard compatible DST disambiguation", () => {
    expect(fromZonedDateTimeInput("2026-01-21T13:14", "America/Toronto")).toBe("2026-01-21T18:14:00.000Z");
    expect(fromZonedDateTimeInput("2026-03-08T02:30", "America/Toronto")).toBe("2026-03-08T07:30:00.000Z");
    expect(fromZonedDateTimeInput("2026-11-01T01:30", "America/Toronto")).toBe("2026-11-01T05:30:00.000Z");
    expect(fromZonedDateTimeInput("", "UTC")).toBeNull();
    expect(() => fromZonedDateTimeInput("2030-02-31T12:00", "UTC")).toThrow();
  });
});
