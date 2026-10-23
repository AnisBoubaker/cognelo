import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const db = vi.hoisted(() => ({
  activity: { findFirst: vi.fn() },
  activityAttempt: { findMany: vi.fn(), findFirst: vi.fn() },
  activityConversation: { findMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
  activityConversationMessage: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  activityConversationRead: { findUnique: vi.fn(), upsert: vi.fn() },
  activityMessageBroadcast: { findMany: vi.fn() },
  courseGroupActivity: { findFirst: vi.fn() },
  courseGroupParticipant: { findFirst: vi.fn(), count: vi.fn() },
  $transaction: vi.fn()
}));
const tx = vi.hoisted(() => ({
  activity: { findFirst: vi.fn() },
  activityMessageBroadcast: { create: vi.fn() },
  activityConversationMessage: { createMany: vi.fn(), create: vi.fn() },
  courseGroupActivity: { findMany: vi.fn() },
  activityAttempt: { findMany: vi.fn() },
  activityConversation: { upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() }
}));
const authorization = vi.hoisted(() => ({ getActivityMessagingGroupScope: vi.fn(), assertCanGradeGroup: vi.fn() }));
const contentAccess = vi.hoisted(() => ({ assertActivityContentAccess: vi.fn() }));
vi.mock("./activity-content-access", () => contentAccess);
const gradebook = vi.hoisted(() => ({ getActivityAttemptAvailability: vi.fn() }));
const groups = vi.hoisted(() => ({ getGroupAssignedActivity: vi.fn() }));

vi.mock("@cognelo/db", () => ({ prisma: db, Prisma: {} }));
vi.mock("./authorization", () => authorization);
vi.mock("./gradebook", () => gradebook);
vi.mock("./groups", () => groups);

import {
  getLearnerActivityConversation,
  getStoredLearnerActivityConversation,
  markLearnerActivityConversationRead,
  sendActivityBroadcast, sendLearnerActivityMessage, sendStaffActivityReply, getStaffActivityConversation, listActiveConversations, getLearnerActivityMessagingStatus
} from "./activity-messaging";

const student: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: "Student One",
  firstName: "Student",
  lastName: "One",
  roles: ["student"]
};
const teacher: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: "Ada Teacher",
  firstName: "Ada",
  lastName: "Teacher",
  roles: ["teacher"]
};
const now = new Date("2026-10-11T16:00:00.000Z");
const enabledMetadata = { allGroupsAssignment: { messagingEnabled: true } };

describe("activity attempt messaging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((callback) => typeof callback === "function" ? callback(tx) : Promise.all(callback));
    groups.getGroupAssignedActivity.mockResolvedValue({
      id: "activity-1",
      metadata: enabledMetadata,
      activityType: { key: "coding-exercise" },
      assignment: { id: "assignment-1", metadata: {} }
    });
    db.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });
    gradebook.getActivityAttemptAvailability.mockResolvedValue({ canStart: true, reason: null });
    db.activityConversation.findMany.mockResolvedValue([]);
    db.activityConversation.findFirst.mockResolvedValue(null);
    tx.activityConversation.findMany.mockResolvedValue([]);
    tx.courseGroupActivity.findMany.mockResolvedValue([]);
    tx.activityAttempt.findMany.mockResolvedValue([]);
    db.activityConversation.updateMany.mockResolvedValue({ count: 0 });
    db.activityConversation.upsert.mockResolvedValue({
      id: "conversation-2",
      attemptId: null,
      attemptNumber: 2
    });
    db.activityConversationMessage.findMany.mockResolvedValue([]);
    db.activityConversationMessage.count.mockResolvedValue(0);
    db.activityConversationRead.findUnique.mockResolvedValue(null);
    db.activity.findFirst.mockResolvedValue({ id: "activity-1", metadata: enabledMetadata });
    tx.activity.findFirst.mockResolvedValue({ metadata: enabledMetadata });
    db.courseGroupActivity.findFirst.mockResolvedValue({ id: "assignment-1" });
    authorization.getActivityMessagingGroupScope.mockResolvedValue(null);
  });

  it("reads stored notices using the student's enrollment without renewing presence", async () => {
    db.activityConversation.findFirst.mockResolvedValue({ id: "conversation-1", attemptId: "attempt-1", attemptNumber: 1, activity: { metadata: enabledMetadata } });
    await expect(getStoredLearnerActivityConversation(student, "course-1", "group-1", "activity-1"))
      .resolves.toMatchObject({ conversation: { id: "conversation-1" } });
    expect(db.activityConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { courseId: "course-1", groupId: "group-1", activityId: "activity-1", participant: { userId: student.id, role: "student" } }
    }));
    expect(db.activityConversation.upsert).not.toHaveBeenCalled();
  });

  it("creates a fresh logical conversation after a completed untimed attempt", async () => {
    db.activityAttempt.findMany.mockResolvedValue([
      { id: "attempt-1", attemptNumber: 1, lifecycle: "graded" }
    ]);

    await expect(getLearnerActivityConversation(
      student,
      "course-1",
      "group-1",
      "activity-1",
      now
    )).resolves.toMatchObject({ conversation: { id: "conversation-2", attemptId: null, attemptNumber: 2 } });

    expect(db.activityConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ attemptNumber: { not: 2 } }),
      data: { closedAt: now }
    }));
    expect(db.activityConversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ attemptNumber: 2, attemptId: null })
    }));
  });

  it("never reuses a deleted attempt number for a later conversation", async () => {
    db.activityAttempt.findMany.mockResolvedValue([
      { id: "attempt-2", attemptNumber: 2, lifecycle: "deleted" },
      { id: "attempt-1", attemptNumber: 1, lifecycle: "graded" }
    ]);
    db.activityConversation.upsert.mockResolvedValue({
      id: "conversation-3",
      attemptId: null,
      attemptNumber: 3
    });

    await getLearnerActivityConversation(student, "course-1", "group-1", "activity-1", now);

    expect(db.activityConversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ attemptNumber: 3, attemptId: null })
    }));
  });

  it("keeps presence while disabled and reveals the same attempt when enabled live", async () => {
    const activity = { id: "activity-1", activityType: { key: "mcq" }, assignment: { id: "assignment-1", metadata: {} }, metadata: {} };
    db.activityAttempt.findMany.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1, lifecycle: "started" }]);
    db.activityConversation.upsert.mockResolvedValue({ id: "conversation-1", attemptId: "attempt-1", attemptNumber: 1 });
    groups.getGroupAssignedActivity.mockResolvedValue(activity);
    await expect(getLearnerActivityConversation(student, "course-1", "group-1", "activity-1", now)).resolves.toEqual({ conversation: null });
    expect(db.activityConversation.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ lastSeenAt: now }) }));
    expect(db.activityConversationMessage.findMany).not.toHaveBeenCalled();
    groups.getGroupAssignedActivity.mockResolvedValue({ ...activity, metadata: enabledMetadata });
    await expect(getLearnerActivityConversation(student, "course-1", "group-1", "activity-1", now)).resolves.toMatchObject({ conversation: { id: "conversation-1", attemptId: "attempt-1" } });
    groups.getGroupAssignedActivity.mockResolvedValue({ ...activity, metadata: { allGroupsAssignment: { messagingEnabled: false } } });
    await expect(getLearnerActivityConversation(student, "course-1", "group-1", "activity-1", now)).resolves.toEqual({ conversation: null });
    expect(db.activityConversationMessage.findMany).toHaveBeenCalledTimes(1);
  });

  it("hides stored notices and rejects read receipts while messaging is disabled", async () => {
    db.activityConversation.findFirst.mockResolvedValue({ id: "conversation-1", activity: { metadata: {} } });
    await expect(getStoredLearnerActivityConversation(student, "course-1", "group-1", "activity-1")).resolves.toEqual({ conversation: null });
    await expect(markLearnerActivityConversationRead(student, "course-1", "group-1", "activity-1", "conversation-1"))
      .rejects.toMatchObject({ code: "ACTIVITY_MESSAGING_DISABLED" });
    expect(db.activityConversationMessage.findMany).not.toHaveBeenCalled();
    expect(db.activityConversationRead.upsert).not.toHaveBeenCalled();
  });

  it("rejects broadcasts when the activity has not enabled messaging", async () => {
    db.activity.findFirst.mockResolvedValue({ id: "activity-1", metadata: {} });
    await expect(sendActivityBroadcast(teacher, "course-1", "activity-1", "Notice"))
      .rejects.toMatchObject({ code: "ACTIVITY_MESSAGING_DISABLED" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rechecks the switch before writing a broadcast", async () => {
    db.activityConversation.findMany.mockResolvedValue([{ id: "conversation-1", groupId: "group-1", groupActivityId: "assignment-1", participantId: "participant-1", attemptNumber: 1, attempt: { lifecycle: "started" } }]);
    db.activityAttempt.findMany.mockResolvedValue([]);
    tx.activity.findFirst.mockResolvedValue({ metadata: {} });
    await expect(sendActivityBroadcast(teacher, "course-1", "activity-1", "Notice"))
      .rejects.toMatchObject({ code: "ACTIVITY_MESSAGING_DISABLED" });
    expect(tx.activityMessageBroadcast.create).not.toHaveBeenCalled();
  });

  it("does not create a timed conversation before the real attempt starts", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({
      id: "activity-1",
      activityType: { key: "coding-exercise" },
      assignment: { id: "assignment-1", metadata: { timeLimitMinutes: 30 } }
    });
    db.activityAttempt.findMany.mockResolvedValue([]);

    await expect(getLearnerActivityConversation(
      student,
      "course-1",
      "group-1",
      "activity-1",
      now
    )).resolves.toEqual({ conversation: null });
    expect(db.activityConversation.upsert).not.toHaveBeenCalled();
  });

  it("fans one broadcast out to enrolled offline students without renewing presence", async () => {
    tx.courseGroupActivity.findMany.mockResolvedValue([
      { id: "assignment-1", groupId: "group-1", group: { participants: [{ id: "participant-1" }] } },
      { id: "assignment-2", groupId: "group-2", group: { participants: [{ id: "participant-2" }] } }
    ]);
    tx.activityConversation.upsert.mockResolvedValueOnce({ id: "conversation-1" }).mockResolvedValueOnce({ id: "conversation-2" });
    tx.activityMessageBroadcast.create.mockResolvedValue({ id: "broadcast-1" });
    tx.activityConversationMessage.createMany.mockResolvedValue({ count: 2 });

    await expect(sendActivityBroadcast(
      teacher,
      "course-1",
      "activity-1",
      "Please reread question 3.",
      null,
      now
    )).resolves.toMatchObject({ broadcast: { id: "broadcast-1", recipientCount: 2, readCount: 0 } });

    expect(tx.activityConversationMessage.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ conversationId: "conversation-1", broadcastId: "broadcast-1" }),
        expect.objectContaining({ conversationId: "conversation-2", broadcastId: "broadcast-1" })
      ])
    });
  });

  it("excludes submitted attempts from presence, even without a linked attempt id", async () => {
    db.activityConversation.findMany.mockResolvedValue([{ id: "conversation-1", groupId: "group-1", groupActivityId: "assignment-1", participantId: "participant-1", attemptNumber: 1, attempt: null }]);
    db.activityAttempt.findMany.mockResolvedValue([{ groupActivityId: "assignment-1", participantId: "participant-1", attemptNumber: 1, lifecycle: "submitted" }]);
    expect(await listActiveConversations("course-1", "activity-1", null, now)).toEqual([]);
  });

  it("returns only a revision and unread count during the existing learner heartbeat", async () => {
    db.activityAttempt.findMany.mockResolvedValue([]);
    db.activityConversationMessage.findFirst.mockResolvedValue({ id: "latest" });
    const status = await getLearnerActivityMessagingStatus(student, "course-1", "group-1", "activity-1", true);
    expect(status).toMatchObject({ id: "conversation-2", version: "conversation-2:false:latest", unreadCount: 0 });
    expect(status).not.toHaveProperty("messages");
    expect(db.activityConversationMessage.findMany).not.toHaveBeenCalled();
    expect(db.activityConversationMessage.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true } }));
  });

  it("never bypasses activity content closure through stored history or read receipts", async () => {
    contentAccess.assertActivityContentAccess.mockRejectedValue(new Error("closed"));
    await expect(getStoredLearnerActivityConversation(student, "course-1", "group-1", "activity-1")).rejects.toThrow("closed");
    await expect(markLearnerActivityConversationRead(student, "course-1", "group-1", "activity-1", "conversation-1")).rejects.toThrow("closed");
    expect(db.activityConversation.findFirst).not.toHaveBeenCalled();
  });

  it("does not allow students to send when two-way messaging is off", async () => {
    db.activityAttempt.findMany.mockResolvedValue([]);
    await expect(sendLearnerActivityMessage(student, "course-1", "group-1", "activity-1", "Question")).rejects.toMatchObject({ code: "ACTIVITY_REPLY_DISABLED" });
    expect(tx.activityConversationMessage.create).not.toHaveBeenCalled();
  });

  it("uses the current student's conversation and rechecks two-way permission inside the write", async () => {
    groups.getGroupAssignedActivity.mockResolvedValue({ metadata: { allGroupsAssignment: { messagingEnabled: true, twoWayMessagingEnabled: true } }, activityType: { key: "mcq" }, assignment: { id: "assignment-1", metadata: {} } });
    db.activityAttempt.findMany.mockResolvedValue([]);
    await expect(sendLearnerActivityMessage(student, "course-1", "group-1", "activity-1", "Question")).rejects.toMatchObject({ code: "ACTIVITY_REPLY_DISABLED" });
    tx.activity.findFirst.mockResolvedValue({ metadata: { allGroupsAssignment: { messagingEnabled: true, twoWayMessagingEnabled: true } } });
    await sendLearnerActivityMessage(student, "course-1", "group-1", "activity-1", "  Question  ");
    expect(tx.activityConversationMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ conversationId: "conversation-2", senderUserId: student.id, senderKind: "student", body: "Question" }) });
  });

  it("requires a student-initiated conversation before a teacher can reply", async () => {
    db.courseGroupParticipant.findFirst.mockResolvedValue({ groupId: "group-1", firstName: "Student", lastName: "One" });
    tx.activity.findFirst.mockResolvedValue({ metadata: { allGroupsAssignment: { messagingEnabled: true, twoWayMessagingEnabled: true } } });
    tx.activityConversation.findFirst.mockResolvedValue(null);
    await expect(sendStaffActivityReply(teacher, "course-1", "activity-1", "participant-1", "Reply")).rejects.toMatchObject({ code: "ACTIVITY_CONVERSATION_NOT_STARTED" });
    expect(tx.activityConversationMessage.create).not.toHaveBeenCalled();
  });

  it("checks section permission before reading or replying to a student", async () => {
    db.courseGroupParticipant.findFirst.mockResolvedValue({ groupId: "other-group", firstName: "Student", lastName: "One" });
    authorization.assertCanGradeGroup.mockRejectedValue(new Error("forbidden"));
    await expect(getStaffActivityConversation(teacher, "course-1", "activity-1", "participant-1")).rejects.toThrow("forbidden");
    await expect(sendStaffActivityReply(teacher, "course-1", "activity-1", "participant-1", "Reply")).rejects.toThrow("forbidden");
    expect(db.activityConversationMessage.findMany).not.toHaveBeenCalled();
  });

  it("does not accept a pagination cursor from another conversation", async () => {
    db.courseGroupParticipant.findFirst.mockResolvedValue({ groupId: "group-1", firstName: "Student", lastName: "One" });
    db.activityConversationMessage.findFirst.mockResolvedValue(null);
    await expect(getStaffActivityConversation(teacher, "course-1", "activity-1", "participant-1", { before: "someone-elses-message" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.activityConversationMessage.findMany).not.toHaveBeenCalled();
  });
});
