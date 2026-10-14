import { prisma } from '@cognelo/db';
import { test, expect, ORIGINAL_SOURCE } from './fixtures/bank-course';
import { assignCourseTest, responseJson } from './fixtures/activity-suite';

test('@regression server countdown ignores browser clock skew and submits once at real expiry', async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const title = `Clock skew investigation ${data.token}`;
  const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
    title, lifecycle: 'published', settings: { timeLimitMinutes: 1, navigationMode: 'free', randomizeItems: false, allowResume: true },
    contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
  } }));
  const activityId = created.activity.id;
  await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
    source: 'local', activityTypeKey: 'mcq', title: 'Clock test', lifecycle: 'published', config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 1, isRequired: true
  } }));
  await assignCourseTest(data, activityId, title);
  const assignedPath = `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
  const responses: unknown[] = [];
  page.on('response', async (response) => {
    if (response.url().endsWith(`${assignedPath}/test/submit`) && response.request().method() === 'POST') {
      const data = await response.json();
      responses.push({ receivedAt: new Date().toISOString(), status: response.status(), onlyIfExpired: response.request().postDataJSON().onlyIfExpired, lifecycle: data.runtime?.attempt?.lifecycle, remainingSeconds: data.runtime?.timing?.remainingSeconds, isExpired: data.runtime?.timing?.isExpired });
    }
  });
  await page.goto(assignedPath);
  await page.getByRole('button', { name: 'Start Test', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start Test', exact: true }).click();
  await page.getByLabel('Four', { exact: true }).check();
  await expect.poll(async () => {
    const row = await prisma.testItemAttempt.findFirst({ where: { parentAttempt: { activityId } } });
    const result = row?.result as { state?: { answers?: Record<string, string[]> } } | undefined;
    return Object.values(result?.state?.answers ?? {}).some((choices) => choices.length > 0);
  }).toBe(true);
  for (const offset of [120_000, -120_000]) {
    await page.clock.setFixedTime(new Date(Date.now() + offset));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.test-countdown')).toContainText(/00:00:[45]\d|00:01:00/);
    await expect(page.getByLabel('Four', { exact: true })).toBeChecked();
  }
  expect(responses).toHaveLength(0);
  const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
  await prisma.activityAttempt.update({ where: { id: attempt.id }, data: { startedAt: new Date(Date.now() - 61_000) } });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(async () => (await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).lifecycle).toBe('graded');
  expect(responses).toHaveLength(1);
  const child = await prisma.testItemAttempt.findFirstOrThrow({ where: { parentAttemptId: attempt.id } });
  expect(child.rawScore).toBe(1);
});

test('@regression disconnected Test recovery preserves drafts, respects extensions and is idempotent', async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  const title = `Clock skew investigation ${data.token}`;
  const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
    title, lifecycle: 'published', settings: { timeLimitMinutes: 1, navigationMode: 'free', randomizeItems: false, allowResume: true },
    contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
  } }));
  const activityId = created.activity.id;
  await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
    source: 'local', activityTypeKey: 'mcq', title: 'Clock test', lifecycle: 'published', config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 1, isRequired: true
  } }));
  await assignCourseTest(data, activityId, title);
  const assignedPath = `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
  await page.goto(assignedPath);
  await page.getByRole('button', { name: 'Start Test', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start Test', exact: true }).click();
  await page.getByLabel('Four', { exact: true }).check();
  await expect.poll(async () => {
    const row = await prisma.testItemAttempt.findFirst({ where: { parentAttempt: { activityId } } });
    const result = row?.result as { state?: { answers?: Record<string, string[]> } } | undefined;
    return Object.values(result?.state?.answers ?? {}).some((choices) => choices.length > 0);
  }).toBe(true);
  await page.goto('about:blank');
  const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
  const child = await prisma.testItemAttempt.findFirstOrThrow({ where: { parentAttemptId: attempt.id } });
  const startedAt = new Date(Date.now() - 91_000);
  await prisma.activityAttempt.update({ where: { id: attempt.id }, data: { startedAt } });
  const assignment = await prisma.courseGroupActivity.findUniqueOrThrow({ where: { id: attempt.groupActivityId } });
  const metadata = assignment.metadata as Record<string, unknown>;
  await prisma.courseGroupActivity.update({ where: { id: assignment.id }, data: { metadata: { ...metadata, timeLimitMinutes: 10 } } });
  const progressPath = `/api/courses/${data.courseId}/gradebook?view=in-progress-attempts&activityId=${activityId}&groupId=${data.groupId}`;
  expect((await responseJson<{ attempts: unknown[] }>(await teacherApi.get(progressPath))).attempts).toHaveLength(1);
  await prisma.courseGroupActivity.update({ where: { id: assignment.id }, data: { metadata: { ...metadata, timeLimitMinutes: 1 } } });
  const exception = await prisma.activityAssignmentException.create({ data: {
    groupActivityId: assignment.id, participantId: attempt.participantId, priority: 0,
    settings: { overrideFields: ['timeLimit'], timeLimitMinutes: 10 }
  } });
  expect((await responseJson<{ attempts: unknown[] }>(await teacherApi.get(progressPath))).attempts).toHaveLength(1);
  await prisma.activityAssignmentException.update({ where: { id: exception.id }, data: { settings: { overrideFields: ['timeLimit'], timeLimitMinutes: null } } });
  expect((await responseJson<{ attempts: unknown[] }>(await teacherApi.get(progressPath))).attempts).toHaveLength(1);
  await prisma.activityAssignmentException.delete({ where: { id: exception.id } });
  await prisma.testSubmissionClaim.create({ data: { parentAttemptId: attempt.id, status: 'processing' } });
  expect((await responseJson<{ attempts: unknown[] }>(await teacherApi.get(progressPath))).attempts).toHaveLength(1);
  await prisma.testSubmissionClaim.update({ where: { parentAttemptId: attempt.id }, data: { updatedAt: new Date(Date.now() - 31 * 60_000) } });
  // The full gradebook and its lightweight results feed both perform recovery.
  await responseJson(await teacherApi.get(`/api/courses/${data.courseId}/gradebook?activityId=${activityId}&groupId=${data.groupId}`));
  for (let read = 0; read < 2; read++) {
    expect((await responseJson<{ attempts: unknown[] }>(await teacherApi.get(progressPath))).attempts).toHaveLength(0);
  }
  const recovered = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { testItemAttempts: true } });
  expect(recovered.lifecycle).toBe('submitted');
  expect(recovered.startedAt).toEqual(startedAt);
  expect(recovered.submittedAt?.getTime()).toBe(startedAt.getTime() + 60_000);
  expect(recovered.testItemAttempts[0].result).toEqual(child.result);
  expect(recovered.testItemAttempts[0].lifecycle).toBe('submitted');
  expect(recovered.testItemAttempts[0].rawScore).toBeNull();
  expect(await prisma.courseAuditEvent.count({ where: { targetId: attempt.id, eventType: 'test_timeout_recovered' } })).toBe(1);
  await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/gradebook/attempts/${attempt.id}/regrade`, { data: { reason: 'Grade recovered response' } }));
  const graded = await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { testItemAttempts: true } });
  expect(graded.lifecycle).toBe('graded');
  expect(graded.testItemAttempts[0].rawScore).toBe(1);
  expect(graded.submittedAt).toEqual(recovered.submittedAt);
});

test('@regression deferred timeout submission waits before retrying and accepts live time changes', async ({ bankCourse: data, teacherApi, studentPage: page }) => {
  await page.clock.install();
  const title = `Clock skew investigation ${data.token}`;
  const { test: created } = await responseJson<{ test: { activity: { id: string } } }>(await teacherApi.post(`/api/courses/${data.courseId}/tests`, { data: {
    title, lifecycle: 'published', settings: { timeLimitMinutes: 1, navigationMode: 'free', randomizeItems: false, allowResume: true },
    contentPlacement: { parentId: null, titleSnapshot: title, isVisible: true, position: 1, metadata: {} }
  } }));
  const activityId = created.activity.id;
  await responseJson(await teacherApi.post(`/api/courses/${data.courseId}/activities/${activityId}/test/items`, { data: {
    source: 'local', activityTypeKey: 'mcq', title: 'Clock test', lifecycle: 'published', config: { source: ORIGINAL_SOURCE, randomizeChoices: false }, pointsPossible: 1, isRequired: true
  } }));
  await assignCourseTest(data, activityId, title);
  const assignedPath = `/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${activityId}`;
  await page.goto(assignedPath);
  await page.getByRole('button', { name: 'Start Test', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start Test', exact: true }).click();
  await page.getByLabel('Four', { exact: true }).check();
  await expect.poll(async () => {
    const row = await prisma.testItemAttempt.findFirst({ where: { parentAttempt: { activityId } } });
    const result = row?.result as { state?: { answers?: Record<string, string[]> } } | undefined;
    return Object.values(result?.state?.answers ?? {}).some((choices) => choices.length > 0);
  }).toBe(true);
  const attempt = await prisma.activityAttempt.findFirstOrThrow({ where: { activityId } });
  const assignment = await prisma.courseGroupActivity.findUniqueOrThrow({ where: { id: attempt.groupActivityId } });
  const metadata = assignment.metadata as Record<string, unknown>;
  let submissions = 0;
  await page.route('**/test/submit', async (route) => {
    submissions++;
    if (submissions === 1) {
      await prisma.courseGroupActivity.update({ where: { id: assignment.id }, data: { metadata: { ...metadata, timeLimitMinutes: 2 } } });
    }
    await route.continue();
  });
  await prisma.activityAttempt.update({ where: { id: attempt.id }, data: { startedAt: new Date(Date.now() - 61_000) } });
  const deferred = page.waitForResponse((response) => response.url().endsWith('/test/submit'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const response = await deferred;
  expect((await response.json()).runtime.attempt.lifecycle).toBe('started');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await prisma.courseGroupActivity.update({ where: { id: assignment.id }, data: { metadata: { ...metadata, timeLimitMinutes: 1 } } });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.fastForward(10_000);
  expect(submissions).toBe(1);
  await page.clock.fastForward(11_000);
  await expect.poll(async () => (await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).lifecycle).toBe('graded');
  expect(submissions).toBe(2);
});
