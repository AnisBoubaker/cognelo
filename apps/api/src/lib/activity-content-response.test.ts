import { expect, it, vi } from "vitest";
const access = vi.hoisted(() => vi.fn());
vi.mock("@cognelo/core", () => ({ getActivityContentAccess: access }));
import { activityContentResponse } from "./activity-content-response";
const user = { id: "student", email: "student@example.test", roles: ["student" as const], name: null, firstName: null, lastName: null };
it("keeps authorized file responses intact", async () => {
  access.mockResolvedValue({ locked: false });
  const response = new Response("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } });
  expect(await activityContentResponse(user, "course", "group", "activity", response, true)).toBe(response);
});
it("closes a private file stream if content access closes before delivery", async () => {
  access.mockResolvedValue({ locked: true });
  const cancel = vi.fn();
  const response = new Response(new ReadableStream({ cancel }));
  expect(await activityContentResponse(user, "course", "group", "activity", response, true)).toEqual({ activityContentClosed: true });
  expect(cancel).toHaveBeenCalledOnce();
});
