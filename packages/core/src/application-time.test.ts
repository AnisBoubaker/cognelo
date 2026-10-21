import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { applicationSettings: db } }));
import { getApplicationTime, getApplicationTimeSettings, updateApplicationTimeSettings } from "./application-time";
const user = (roles: string[]) => ({ id: "u", roles }) as never;
beforeEach(() => { vi.clearAllMocks(); db.findUnique.mockResolvedValue({ timeZone: "America/Toronto" }); });
describe("instance timezone", () => {
  it("exposes only the configured zone and server clock", async () => {
    const before = Date.now();
    const result = await getApplicationTime();
    expect(result.timeZone).toBe("America/Toronto");
    expect(Object.keys(result).sort()).toEqual(["serverNow", "timeZone"]);
    expect(Date.parse(result.serverNow)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(result.serverNow)).toBeLessThanOrEqual(Date.now());
  });
  it.each(["student", "teacher"])("rejects non-administrator %s before reading or mutating settings", async (role) => {
    await expect(getApplicationTimeSettings(user([role]))).rejects.toMatchObject({ status: 403 });
    await expect(updateApplicationTimeSettings(user([role]), { timeZone: "UTC" })).rejects.toMatchObject({ status: 403 });
    expect(db.findUnique).not.toHaveBeenCalled(); expect(db.upsert).not.toHaveBeenCalled();
  });
  it("validates zones and records the administrator without changing any deadlines", async () => {
    await expect(updateApplicationTimeSettings(user(["admin"]), { timeZone: "Not/A_Zone" })).rejects.toThrow();
    await expect(updateApplicationTimeSettings(user(["admin"]), { timeZone: "+04:00" })).rejects.toThrow();
    expect(db.upsert).not.toHaveBeenCalled();
    await updateApplicationTimeSettings(user(["admin"]), { timeZone: "America/Toronto" });
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { timeZone: "America/Toronto", updatedById: "u" } }));
    expect((await getApplicationTimeSettings(user(["admin"]))).timeZones).toContain("America/Toronto");
  });
});
