import { prisma } from '@cognelo/db';
import type { Page } from '@playwright/test';
import { expect, test, createAuthenticatedApi, createAuthenticatedApiWithCredentials, loginWithCredentialsThroughUi } from './fixtures/auth';
import { assignCourseTest, provisionActivitySuite, removeActivitySuite, responseJson } from './fixtures/activity-suite';
import type { CourseActivityAssignmentSettings, CourseTest, CourseTestItem, CourseTestRuntime } from '../../apps/web/src/lib/api';

const baselineA = 'print("SAVED_A")\n';
const baselineB = 'print("SAVED_B")\n';
const normalize = (value: string) => value.replace(/\r\n?/g, '\n');

async function scenario(kind: "coding-exercise" | "web-design-coding-exercise" = "coding-exercise") {
  const data = await provisionActivitySuite();
  const teacher = await createAuthenticatedApi('teacher');
  const student = await createAuthenticatedApi('student');
  try {
  const { test: created } = await responseJson<{ test: CourseTest }>(await teacher.post(`/api/courses/${data.courseId}/tests`, { data: {
    title: `Editor undo ${data.token}`, lifecycle: 'published', settings: { navigationMode: 'free', allowResume: true }, contentPlacement: { isVisible: true }
  } }));
  const parentId = created.activity.id;
  const items: CourseTestItem[] = [];
  for (const title of ['Question A', 'Question B']) {
    const { item } = await responseJson<{ item: CourseTestItem }>(await teacher.post(`/api/courses/${data.courseId}/activities/${parentId}/test/items`, { data: {
      source: 'local', activityTypeKey: kind, title,
      config: kind === 'coding-exercise' ? { language: 'python', prompt: 'Edit the saved answer.', starterCode: '', sampleTests: [] } : {
        prompt: 'Edit the saved files.', previewEntry: 'index.html', files: [
          { id: 'shared-html', path: 'index.html', language: 'html', starterCode: '<main>' + title + '</main>', isEditable: true, orderIndex: 0 },
          { id: 'shared-css', path: 'styles.css', language: 'css', starterCode: 'body { color: blue; }', isEditable: true, orderIndex: 1 }
        ]
      }
    } }));
    items.push(item);
  }
  await assignCourseTest(data, parentId, created.activity.title);
  const assigned = `/api/courses/${data.courseId}/groups/${data.groupId}/activities/assigned/${parentId}`;
  const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await student.post(`${assigned}/test`, { data: { sessionId: 'undo-fixture' } }));
  const attemptId = runtime.attempt!.id;
  for (const [index, item] of items.entries()) {
    await responseJson(await student.put(`${assigned}/test/items/${item.id}`, { data: { parentAttemptId: attemptId, sessionId: 'undo-fixture', state: kind === 'coding-exercise' ? { sourceCode: index ? baselineB : baselineA } : { files: item.activity.config.files } } }));
  }
  const saved = async (index: number) => {
    const record = await prisma.testItemAttempt.findUniqueOrThrow({ where: { parentAttemptId_testItemId: { parentAttemptId: attemptId, testItemId: items[index].id } } });
    return (record.result as { state: { sourceCode: string } }).state;
  };
  return { data, teacher, student, items, parentId, attemptId, assigned, saved, close: async () => {
    await teacher.dispose(); await student.dispose(); await removeActivitySuite(data);
  } };
  } catch (error) {
    await teacher.dispose(); await student.dispose(); await removeActivitySuite(data);
    throw error;
  }
}

async function editorState(page: Page, activityId: string) {
  return page.evaluate(id => {
    const monaco = (window as typeof window & { monaco?: typeof import('monaco-editor') }).monaco;
    const editor = monaco?.editor.getEditors().find(editor => editor.getModel()?.uri.toString().includes(id));
    const model = editor?.getModel();
    return model ? { value: model.getValue().replace(/\r\n?/g, '\n'), uri: model.uri.toString(), undo: model.canUndo(), redo: model.canRedo(), version: model.getVersionId() } : null;
  }, activityId);
}

async function expectSource(page: Page, activityId: string, value: string) {
  await expect.poll(async () => (await editorState(page, activityId))?.value).toBe(value);
}

async function typeAtEnd(page: Page, title: string, value: string) {
  await page.getByRole('textbox', { name: title, exact: true }).focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(value);
}

async function undo(page: Page, title: string) {
  await page.getByRole('textbox', { name: title, exact: true }).focus();
  // Desktop Chrome's Windows user agent makes Monaco use Windows shortcuts,
  // even when this browser executable is hosted on macOS.
  await page.keyboard.press('Control+z');
}
async function redo(page: Page, title: string) {
  await page.getByRole('textbox', { name: title, exact: true }).focus();
  await page.keyboard.press('Control+Shift+z');
}

async function waitForSaves(page: Page) {
  await expect(page.getByRole('button', { name: 'Next activity', exact: true })).toBeEnabled();
}

test('saved code is a fresh baseline; edits, undo and redo autosave normally after slow loading and reload', async ({ studentPage: page }) => {
  test.setTimeout(120_000);
  const s = await scenario();
  try {
    let writes = 0;
    page.on('request', request => { if (request.method() === 'PUT' && request.url().includes(`/test/items/${s.items[0].id}`)) writes++; });
    await page.route(`**/test/items/${s.items[0].id}?*`, async route => {
      if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 300));
      await route.continue();
    });
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    expect(writes).toBe(0);
    expect((await editorState(page, s.items[0].activity.id))?.undo).toBe(false);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    expect(writes).toBe(0);
    await typeAtEnd(page, 'Question A', 'x');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA + 'x');
    writes = 0;
    await page.reload();
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    expect(writes).toBe(0);
    expect((await editorState(page, s.items[0].activity.id))?.undo).toBe(false);
    await typeAtEnd(page, 'Question A', 'y');
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'xy');
    await waitForSaves(page);
    expect(Object.keys(await s.saved(0))).toEqual(['sourceCode']);
    expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes('SAVED_A')))).toBe(false);
  } finally { await s.close(); }
});

test('questions keep independent undo and redo stacks through navigation and policy refresh', async ({ studentPage: page }) => {
  const s = await scenario();
  try {
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    await typeAtEnd(page, 'Question A', 'a');
    await waitForSaves(page);
    const a = await editorState(page, s.items[0].activity.id);
    await page.getByRole('button', { name: 'Next activity', exact: true }).click();
    await expectSource(page, s.items[1].activity.id, baselineB);
    await undo(page, 'Question B');
    await expectSource(page, s.items[1].activity.id, baselineB);
    await typeAtEnd(page, 'Question B', 'b');
    await page.getByRole('button', { name: 'Previous activity', exact: true }).click();
    await expectSource(page, s.items[0].activity.id, baselineA + 'a');
    expect((await editorState(page, s.items[0].activity.id))?.uri).toBe(a?.uri);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    await waitForSaves(page);
    await page.getByRole('button', { name: 'Next activity', exact: true }).click();
    await expectSource(page, s.items[1].activity.id, baselineB + 'b');
    await undo(page, 'Question B');
    await expectSource(page, s.items[1].activity.id, baselineB);
    await page.getByRole('button', { name: 'Previous activity', exact: true }).click();
    await expectSource(page, s.items[0].activity.id, baselineA);
    expect((await editorState(page, s.items[0].activity.id))?.redo).toBe(true);
    const refreshed = page.waitForResponse(response => response.url().includes(`/activities/assigned/${s.parentId}/test?`) && response.request().method() === 'GET');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await refreshed;
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'a');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA + 'a');
    expect(normalize((await s.saved(1)).sourceCode)).toBe(baselineB);
  } finally { await s.close(); }
});

test('undo during a delayed autosave preserves write order and redo through refresh', async ({ studentPage: page }) => {
  const s = await scenario();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let blocked = false;
  const writes: Array<Record<string, unknown>> = [];
  try {
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    await page.route(`**/test/items/${s.items[0].id}`, async route => {
      if (route.request().method() === 'PUT') {
        writes.push(route.request().postDataJSON().state);
        if (!blocked) { blocked = true; await held; }
      }
      await route.continue();
    });
    await typeAtEnd(page, 'Question A', 'x');
    await expect.poll(() => blocked).toBe(true);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    await expect(page.getByRole('button', { name: 'Next activity', exact: true })).toBeDisabled();
    const refresh = page.waitForResponse(response => response.url().includes(`/activities/assigned/${s.parentId}/test?`) && response.request().method() === 'GET');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    release();
    await waitForSaves(page);
    await refresh;
    expect(writes.map(state => normalize(String(state.sourceCode)))).toEqual([baselineA + 'x', baselineA]);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
    expect((await editorState(page, s.items[0].activity.id))?.redo).toBe(true);
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA + 'x');
    expect(writes.every(state => Object.keys(state).join(',') === 'sourceCode')).toBe(true);
    expect(normalize((await s.saved(1)).sourceCode)).toBe(baselineB);
  } finally { release(); await s.close(); }
});

test('failed draft loading cannot expose an editable blank answer or overwrite the saved answer', async ({ studentPage: page }) => {
  const s = await scenario();
  try {
    let fail = true;
    let writes = 0;
    page.on('request', request => { if (request.method() === 'PUT' && request.url().includes('/test/items/')) writes++; });
    await page.route(`**/test/items/${s.items[0].id}?*`, async route => {
      if (fail && route.request().method() === 'GET') { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Temporary draft load failure' } }) }); }
      else await route.continue();
    });
    await page.goto(s.assigned.replace('/api', ''));
    const retry = page.getByRole('button', { name: 'Retry loading answer', exact: true });
    await expect(retry).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Question A', exact: true })).toHaveCount(0);
    expect(writes).toBe(0);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
    fail = false;
    await retry.click();
    await expectSource(page, s.items[0].activity.id, baselineA);
    expect(writes).toBe(0);
    await typeAtEnd(page, 'Question A', 'x');
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
  } finally { await s.close(); }
});

test('leaving and reopening a Test discards models and starts from its saved answer', async ({ studentPage: page }) => {
  const s = await scenario();
  try {
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    await typeAtEnd(page, 'Question A', 'x');
    await waitForSaves(page);
    const previous = await editorState(page, s.items[0].activity.id);
    await page.getByRole('link', { name: 'Back to course', exact: true }).click();
    await expect.poll(() => page.evaluate(uri => (window as typeof window & { monaco: typeof import('monaco-editor') }).monaco.editor.getModels().some(model => model.uri.toString() === uri), previous!.uri)).toBe(false);
    await page.getByRole('link', { name: `Editor undo ${s.data.token}`, exact: true }).click();
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    const reopened = await editorState(page, s.items[0].activity.id);
    expect(reopened?.uri).not.toBe(previous?.uri);
    expect(reopened?.undo).toBe(false);
    expect(reopened?.redo).toBe(false);
    await typeAtEnd(page, 'Question A', 'y');
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'xy');
    await waitForSaves(page);
  } finally { await s.close(); }
});

test('undo cannot recover another student answer after logout and sign-in in the same tab', async ({ studentPage: page }) => {
  const s = await scenario();
  let secondUserId: string | null = null;
  let secondApi: Awaited<ReturnType<typeof createAuthenticatedApiWithCredentials>> | null = null;
  try {
    const account = { email: `undo-${s.data.token}@cognelo.local`, password: 'Password123!Undo' };
    const { participant } = await responseJson<{ participant: { userId: string } }>(await s.teacher.post(`/api/courses/${s.data.courseId}/groups/${s.data.groupId}/participants`, {
      data: { email: account.email, firstName: 'Undo', lastName: 'Learner', role: 'student', assignedPassword: account.password }
    }));
    secondUserId = participant.userId;
    secondApi = await createAuthenticatedApiWithCredentials(account);
    const { runtime } = await responseJson<{ runtime: CourseTestRuntime }>(await secondApi.post(`${s.assigned}/test`, { data: { sessionId: 'second-student' } }));
    const secondAnswer = 'print("SECOND_STUDENT")\n';
    await responseJson(await secondApi.put(`${s.assigned}/test/items/${s.items[0].id}`, { data: { parentAttemptId: runtime.attempt!.id, sessionId: 'second-student', state: { sourceCode: secondAnswer } } }));
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    await typeAtEnd(page, 'Question A', 'x');
    await waitForSaves(page);
    const first = await editorState(page, s.items[0].activity.id);
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await loginWithCredentialsThroughUi(page, account);
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, secondAnswer);
    expect((await editorState(page, s.items[0].activity.id))?.uri).not.toBe(first?.uri);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, secondAnswer);
    await typeAtEnd(page, 'Question A', 'y');
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, secondAnswer);
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA + 'x');
  } finally {
    await secondApi?.dispose(); await s.close();
    if (secondUserId) await prisma.user.delete({ where: { id: secondUserId } });
  }
});

test('past submissions and later attempts cannot share undo or redo history', async ({ studentPage: page }) => {
  test.setTimeout(120_000);
  const s = await scenario();
  try {
    const settingsPath = `/api/courses/${s.data.courseId}/activities/${s.parentId}/assign-all-groups`;
    const { settings } = await responseJson<{ settings: CourseActivityAssignmentSettings }>(await s.teacher.get(settingsPath));
    await responseJson(await s.teacher.post(settingsPath, { data: { ...settings.general,
      gradebookSettings: { ...settings.general.gradebookSettings, attemptLimitMode: 'max_attempts', maxAttempts: 2 },
      groupAssignments: settings.groups.map(group => ({ ...group, overrideFields: [] })), confirmActiveStudents: true
    } }));
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    await typeAtEnd(page, 'Question A', 'x');
    await undo(page, 'Question A');
    await waitForSaves(page);
    const first = await editorState(page, s.items[0].activity.id);
    expect(first?.redo).toBe(true);
    await responseJson(await s.student.post(`${s.assigned}/test/submit`, { data: { parentAttemptId: s.attemptId, sessionId: 'undo-fixture' } }));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', { name: 'Start Test', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Test', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start Test', exact: true }).click();
    await expectSource(page, s.items[0].activity.id, '');
    expect((await editorState(page, s.items[0].activity.id))?.uri).not.toBe(first?.uri);
    await undo(page, 'Question A');
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, '');
    await page.getByRole('tab', { name: 'Previous submissions', exact: true }).click();
    await expectSource(page, s.items[0].activity.id, baselineA);
    expect((await editorState(page, s.items[0].activity.id))?.undo).toBe(false);
    await page.getByRole('tab', { name: 'New attempt', exact: true }).click();
    await expectSource(page, s.items[0].activity.id, '');
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, '');
    await typeAtEnd(page, 'Question A', 'y');
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, '');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
    expect(await prisma.activityAttempt.count({ where: { activityId: s.parentId } })).toBe(2);
  } finally { await s.close(); }
});

test('Web Design files and questions with identical file ids have separate undo histories', async ({ studentPage: page }) => {
  const s = await scenario('web-design-coding-exercise');
  const htmlA = '<main>Question A</main>';
  const htmlB = '<main>Question B</main>';
  const css = 'body { color: blue; }';
  try {
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].id, htmlA);
    await typeAtEnd(page, 'Editor: index.html', 'x');
    await waitForSaves(page);
    await page.getByRole('tab', { name: 'styles.css', exact: true }).click();
    await expectSource(page, s.items[0].id, css);
    await undo(page, 'Editor: styles.css');
    await expectSource(page, s.items[0].id, css);
    await typeAtEnd(page, 'Editor: styles.css', 'y');
    await page.getByRole('tab', { name: 'index.html', exact: true }).click();
    await expectSource(page, s.items[0].id, htmlA + 'x');
    await undo(page, 'Editor: index.html');
    await expectSource(page, s.items[0].id, htmlA);
    await waitForSaves(page);
    await page.getByRole('button', { name: 'Next activity', exact: true }).click();
    await expectSource(page, s.items[1].id, htmlB);
    await undo(page, 'Editor: index.html');
    await redo(page, 'Editor: index.html');
    await expectSource(page, s.items[1].id, htmlB);
    await page.getByRole('button', { name: 'Previous activity', exact: true }).click();
    await expectSource(page, s.items[0].id, htmlA);
    await redo(page, 'Editor: index.html');
    await expectSource(page, s.items[0].id, htmlA + 'x');
    await page.getByRole('tab', { name: 'styles.css', exact: true }).click();
    await expectSource(page, s.items[0].id, css + 'y');
    await undo(page, 'Editor: styles.css');
    await expectSource(page, s.items[0].id, css);
    await waitForSaves(page);
    const savedState = async () => {
      const saved = await prisma.testItemAttempt.findUniqueOrThrow({ where: { parentAttemptId_testItemId: { parentAttemptId: s.attemptId, testItemId: s.items[0].id } } });
      return (saved.result as { state: { files: Array<{ path: string; starterCode: string }> } }).state;
    };
    // The final undo can enqueue its autosave after the navigation button was observed enabled.
    await expect.poll(async () => Object.fromEntries((await savedState()).files.map(file => [file.path, file.starterCode])))
      .toEqual({ 'index.html': htmlA + 'x', 'styles.css': css });
    expect(Object.keys(await savedState())).toEqual(['files']);
  } finally { await s.close(); }
});

test('a failed autosave leaves undo usable and a later redo saves the intended answer', async ({ studentPage: page }) => {
  const s = await scenario();
  try {
    await page.goto(s.assigned.replace('/api', ''));
    await expectSource(page, s.items[0].activity.id, baselineA);
    let fail = true;
    await page.route(`**/test/items/${s.items[0].id}`, async route => {
      if (fail && route.request().method() === 'PUT') {
        fail = false;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Simulated save failure' } }) });
      } else await route.continue();
    });
    await typeAtEnd(page, 'Question A', 'x');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA);
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, baselineA + 'x');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA + 'x');
  } finally { await s.close(); }
});

test('restored answers retain normal undo inside a protected programming template', async ({ studentPage: page }) => {
  const s = await scenario();
  try {
    await responseJson(await s.teacher.put(`/api/courses/${s.data.courseId}/activities/${s.items[0].activity.id}/coding-exercises/hidden-tests`, { data: {
      tests: [], referenceSolution: 'print("reference")',
      privateConfig: { templateSource: 'print("protected prefix")\n{{ STUDENT_CODE }}\nprint("protected suffix")' }
    } }));
    await page.goto(s.assigned.replace('/api', ''));
    await expect(page.getByRole('textbox', { name: 'Question A', exact: true })).toBeVisible();
    await expect.poll(async () => (await editorState(page, s.items[0].activity.id))?.value.includes('SAVED_A')).toBe(true);
    const before = await editorState(page, s.items[0].activity.id);
    expect(before?.undo).toBe(false);
    await typeAtEnd(page, 'Question A', 'x');
    const after = await editorState(page, s.items[0].activity.id);
    expect(after?.value).not.toBe(before?.value);
    await undo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, before!.value);
    await redo(page, 'Question A');
    await expectSource(page, s.items[0].activity.id, after!.value);
    await undo(page, 'Question A');
    await waitForSaves(page);
    expect(normalize((await s.saved(0)).sourceCode)).toBe(baselineA);
  } finally { await s.close(); }
});
