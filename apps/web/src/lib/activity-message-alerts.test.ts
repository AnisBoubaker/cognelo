import { describe, expect, it, vi } from "vitest";
import type { ActivityMessagingStatus } from "./api";
import { createActivityMessageSound, messageSoundStorageKey, newStudentMessageCount } from "./activity-message-alerts";

const empty: ActivityMessagingStatus = { enabled: true, version: "v1", unreadCount: 0, unreadParticipantId: null, studentMessageCount: 0, latestStudentMessage: null };
const one: ActivityMessagingStatus = { ...empty, version: "v2", unreadCount: 1, studentMessageCount: 1, unreadParticipantId: "student", latestStudentMessage: { id: "m1", createdAt: "2026-10-23T16:00:00.000Z", participantId: "student", senderName: "Sam Student" } };

describe("incoming activity message alerts", () => {
  it("does not sound for initial history, repeated polls, or read/deletion/teacher-send revisions", () => {
    expect(newStudentMessageCount(null, one)).toBe(0);
    expect(newStudentMessageCount(one, { ...one })).toBe(0);
    expect(newStudentMessageCount(one, { ...one, version: "new-read-or-staff-revision", unreadCount: 0 })).toBe(0);
  });
  it("detects the first message and batches arrivals between ordinary polls", () => {
    expect(newStudentMessageCount(empty, one)).toBe(1);
    const more = { ...one, studentMessageCount: 4, latestStudentMessage: { ...one.latestStudentMessage!, id: "m4", createdAt: "2026-10-23T16:01:00.000Z" } };
    expect(newStudentMessageCount(one, more)).toBe(3);
    expect(newStudentMessageCount(more, more)).toBe(0);
  });
  it("does not replay old messages on re-enabling or after a history record disappears", () => {
    expect(newStudentMessageCount({ ...empty, enabled: false }, one)).toBe(0);
    expect(newStudentMessageCount(one, { ...one, enabled: false })).toBe(0);
    expect(newStudentMessageCount(one, { ...one, latestStudentMessage: { ...one.latestStudentMessage!, id: "older", createdAt: "2026-10-23T15:00:00.000Z" } })).toBe(0);
  });
  it("keeps sound preferences isolated by account", () => {
    expect(messageSoundStorageKey("teacher-a")).not.toBe(messageSoundStorageKey("teacher-b"));
  });
});

function audioFixture(initialState = "running") {
  const nodes: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const context = {
    state: initialState, currentTime: 10, destination: {}, onstatechange: null as (() => void) | null,
    resume: vi.fn(async () => { context.state = "running"; context.onstatechange?.(); }), close: vi.fn(async () => {}),
    createOscillator: vi.fn(() => {
      const node = { type: "sine", frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
      nodes.push(node); return node;
    }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }))
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const onReady = vi.fn();
  return { context, factory, onReady, nodes, sound: createActivityMessageSound(factory, onReady) };
}

describe("local message chime", () => {
  it("starts no audio without activation and never queues a delayed notification", async () => {
    const { sound, context, factory } = audioFixture("suspended");
    expect(sound.play()).toBe(false);
    expect(factory).not.toHaveBeenCalled();
    sound.unlock();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.createOscillator).not.toHaveBeenCalled();
  });
  it("plays two bounded tones and releases resources on leaving the activity", () => {
    const { sound, nodes, context } = audioFixture();
    sound.unlock();
    expect(sound.play()).toBe(true);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].start).toHaveBeenCalledWith(10);
    expect(nodes[0].stop).toHaveBeenCalledWith(10.2);
    expect(nodes[1].start).toHaveBeenCalledWith(10.14);
    sound.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(sound.play()).toBe(false);
  });
  it("fails quietly if the browser refuses audio activation", () => {
    const sound = createActivityMessageSound(() => { throw new Error("blocked"); }, vi.fn());
    expect(() => sound.unlock()).not.toThrow();
    expect(sound.play()).toBe(false);
  });
});
