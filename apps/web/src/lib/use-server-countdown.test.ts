import { describe, expect, it, vi } from "vitest";
import { remainingServerSeconds } from "./use-server-countdown";

describe("server anchored countdown", () => {
  it("uses monotonic elapsed time despite a wrong or changed wall clock", () => {
    const clock = vi.spyOn(Date, "now");
    try {
      for (const wallClock of [0, 9_999_999_999_999]) {
        clock.mockReturnValue(wallClock);
        expect(remainingServerSeconds(60, 1000, 2000)).toBe(59);
        expect(remainingServerSeconds(60, 1000, 61_000)).toBe(0);
      }
    } finally { clock.mockRestore(); }
  });
  it("accepts refreshed extensions, disabled timing and elapsed expiry", () => {
    expect(remainingServerSeconds(600, 50_000, 51_500)).toBe(599);
    expect(remainingServerSeconds(null, 1000, 80_000)).toBeNull();
    expect(remainingServerSeconds(1, 1000, 80_000)).toBe(0);
  });
});
