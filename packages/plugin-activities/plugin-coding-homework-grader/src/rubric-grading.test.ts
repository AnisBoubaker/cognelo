import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHomeworkGrading, homeworkFeedbackDraft, type HomeworkGradingPolicy } from "./rubric";
const mocks = vi.hoisted(() => ({ attempt: vi.fn(), submission: vi.fn(), assignment: vi.fn(), solution: vi.fn(), course: vi.fn(), artifact: vi.fn(), model: vi.fn(), connection: vi.fn(), policy: vi.fn(), file: vi.fn(), authorize: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { activityAttempt: { findFirst: mocks.attempt }, course: { findUniqueOrThrow: mocks.course } } }));
vi.mock("./db-client", () => ({ prisma: { pluginCodingHomeworkSubmission: { findFirst: mocks.submission, findUnique: vi.fn() }, pluginCodingHomeworkAssignment: { findUnique: mocks.assignment, findUniqueOrThrow: mocks.assignment }, pluginCodingHomeworkTeacherSolution: { findUnique: mocks.solution }, pluginCodingHomeworkReview: { create: mocks.artifact } } }));
vi.mock("@cognelo/core", () => ({ AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }, assertCanGradeGroup: mocks.authorize, assessmentInstructionPrompt: (value: string) => `Teacher policy: ${value}`, generateAiAgentText: mocks.model, getCourseAssessmentFeedbackAiAgentConnection: mocks.connection, getCourseAssessmentFeedbackPolicy: mocks.policy, hashAiFeedbackValue: (value: unknown) => JSON.stringify(value) }));
vi.mock("./hand-in", () => ({ readFrozenHomeworkFile: mocks.file }));
vi.mock("./file-preparation", () => ({ record: (value: unknown) => value && typeof value === "object" ? value : {}, json: (value: unknown) => value }));
const { evaluateHomeworkWithAi, createHomeworkFeedbackDraft, homeworkGradeCompletions, reviseHomeworkTeacherFeedback } = await import("./rubric-grading");
const criterion = { id: "criterion", title: "Understanding", description: "", weightPercent: 100 };
const policy: HomeworkGradingPolicy = { ...defaultHomeworkGrading(), enabled: true, code: { criteria: [criterion], instructions: "Code directions" }, questions: { criteria: [criterion], instructions: "Question directions" } };
const context = { user: { id: "teacher", roles: ["teacher"] }, courseId: "course", groupId: "group", activityId: "activity", coreAttemptId: "attempt", pluginAttemptRef: "submission", activity: { id: "activity", title: "Homework" }, triggerKind: "teacher_single" } as unknown as Parameters<typeof evaluateHomeworkWithAi>[0];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.attempt.mockResolvedValue({ id: "attempt", userId: "student", pluginAttemptRef: "submission" });
  mocks.submission.mockResolvedValue({ id: "submission", coreAttemptId: "attempt", metadata: {}, files: [{ path: "main.c", sizeBytes: 30 }], questions: [{ id: "q1", submissionId: "submission", questionText: "Explain the result.", studentAnswer: "It adds one.", metadata: {} }, { id: "q2", submissionId: "submission", questionText: "Explain the guard.", studentAnswer: "  ", metadata: {} }] });
  mocks.assignment.mockResolvedValue({ settings: { grading: policy }, promptMarkdown: "Implement add one." });
  mocks.solution.mockResolvedValue({ files: [{ path: "main.c", text: "int add(int a){return a+1;}" }] });
  mocks.course.mockResolvedValue({ subject: { teachingLanguage: "fr" } });
  mocks.policy.mockResolvedValue({ enabled: true }); mocks.connection.mockResolvedValue({ model: "assessment-model" });
  mocks.file.mockResolvedValue(Buffer.from("int add(int a){return a+1;}"));
  mocks.artifact.mockResolvedValue({ id: "artifact" });
  mocks.model.mockResolvedValue(JSON.stringify({ noAnswerProvided: false, summary: "Réponse claire", criteria: [{ criterionId: "criterion", scorePercent: 80, feedback: "Bonne justification" }] }));
});
describe("homework rubric assessment boundary", () => {
  it("uses distinct authoritative directions, subject language, individual question evidence and deterministic blank grading", async () => {
    const evaluation = await evaluateHomeworkWithAi(context);
    expect(mocks.model).toHaveBeenCalledTimes(2); // code + one nonblank answer
    expect(mocks.model.mock.calls[0][1].systemPrompt).toContain("Code directions");
    expect(mocks.model.mock.calls[1][1].systemPrompt).toContain("Question directions");
    expect(mocks.model.mock.calls[1][1].systemPrompt).toContain("fr");
    expect(JSON.parse(mocks.model.mock.calls[1][1].userPrompt).evidence.answer).toBe("It adds one.");
    expect(evaluation.feedback).toMatchObject({ codeScore: 80, questionsScore: 40, combinedScore: 68 });
    expect((evaluation.feedback.questions as Array<{ criteria: unknown[] }>)[1].criteria[0]).toMatchObject({ scorePercent: 0, feedback: "Aucune réponse fournie" });
  });
  it("stages complete immutable artifacts without publishing grades or shared source state", async () => {
    await evaluateHomeworkWithAi({ ...context, deferPublication: true });
    expect(mocks.artifact).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: expect.objectContaining({ status: "staged", coreAttemptId: "attempt", promptVersion: "homework-rubric-v3" }) }) }));
  });
  it("requests all deduction evidence inside criterion feedback and preserves long model comments in stored artifacts", async () => {
    const evidence = Array.from({ length: 150 }, (_, index) => `main.c, function f${index}: « return a; » omet l'incrément requis. La valeur retournée reste inchangée.`).join("\n\n");
    mocks.model.mockResolvedValue(JSON.stringify({ noAnswerProvided: false, summary: "Justification détaillée dans la rétroaction du critère.", criteria: [{ criterionId: "criterion", scorePercent: 80, feedback: evidence }] }));
    const evaluation = await evaluateHomeworkWithAi(context);
    const codePrompt = mocks.model.mock.calls[0][1], answerPrompt = mocks.model.mock.calls[1][1];
    for (const prompt of [codePrompt, answerPrompt]) {
      expect(prompt.systemPrompt).toContain("give all examples in the submitted evidence");
      expect(prompt.systemPrompt).toContain("only in the criterion feedback field, as free-form text");
      expect(prompt.systemPrompt).toContain("Penalize each underlying mistake only once");
      expect(prompt.systemPrompt).toContain("exact submitted filename including folders and its 1-based line number or inclusive line range");
      expect(prompt.systemPrompt).toContain("Never restart numbering at a function excerpt");
      expect(prompt.maxOutputTokens).toBeGreaterThan(6000);
    }
    expect(codePrompt.systemPrompt).toContain("quote short exact code excerpts");
    expect(codePrompt.systemPrompt).toContain("Never present private reference-solution code");
    expect(answerPrompt.systemPrompt).toContain("student's actual answer");
    expect(answerPrompt.systemPrompt).toContain("A defect in the code alone does not justify deducting answer points");
    expect(evaluation.feedback).toMatchObject({ code: { criteria: [{ feedback: evidence }] }, questions: [{ criteria: [{ feedback: evidence }] }, { criteria: [{ feedback: "Aucune réponse fournie" }] }] });
    expect(mocks.artifact.mock.calls[0][0].data.rubric).toEqual(evaluation.feedback);
  });
  it("numbers complete frozen files including blank lines and supplies absolute source lines for question excerpts", async () => {
    const source = "// submitted header\r\n\r\nint helper(void) { return 0; }\r\nint add(int a) {\r\n  return a;\r\n}\r\n";
    const header = "// declarations\r\rint add(int a);\n";
    mocks.submission.mockResolvedValue({ id: "submission", coreAttemptId: "attempt", metadata: {},
      files: [{ path: "src/main.c", sizeBytes: Buffer.byteLength(source) }, { path: "include/main.h", sizeBytes: Buffer.byteLength(header) }],
      questions: [{ id: "q1", submissionId: "submission", questionText: "Explain add.", studentAnswer: "It adds one.", metadata: { studentCodeContext: {
        code: "int add(int a) {\n  return a;\n}", filePath: "src/main.c", functionName: "add", languageKey: "c"
      } } }] });
    mocks.file.mockImplementation(async (file: { path: string }) => Buffer.from(file.path === "src/main.c" ? source : header));
    await evaluateHomeworkWithAi(context);
    const codeEvidence = JSON.parse(mocks.model.mock.calls[0][1].userPrompt).evidence;
    const answerEvidence = JSON.parse(mocks.model.mock.calls[1][1].userPrompt).evidence;
    expect(codeEvidence.files).toEqual([
      { path: "src/main.c", numberedText: "1: // submitted header\n2: \n3: int helper(void) { return 0; }\n4: int add(int a) {\n5:   return a;\n6: }\n7: " },
      { path: "include/main.h", numberedText: "1: // declarations\n2: \n3: int add(int a);\n4: " }
    ]);
    expect(answerEvidence.files).toEqual([codeEvidence.files[0]]);
    expect(answerEvidence.context.code).toBe("int add(int a) {\n  return a;\n}");
    expect(answerEvidence.context.filePath).toBe("src/main.c");
  });
  it("leaves grades unchanged for narrative-only review and strips template identity/control fields from model prompts", async () => {
    const current = homeworkFeedbackDraft(policy, ["q1", "q2"]);
    current.code.criteria[0].scorePercent = 80;
    for (const question of current.questions) question.criteria[0].scorePercent = 60;
    const revised = await reviseHomeworkTeacherFeedback({ ...context, currentFeedback: current, feedback: { ...current, summary: "New teacher comment" } });
    expect(revised.gradingResult).toBeUndefined();
    await evaluateHomeworkWithAi({ ...context, batchGuidance: { instructions: "Run policy", templates: [{ coreAttemptId: "PRIVATE ATTEMPT", submission: { participantId: "PRIVATE PERSON", privateSharedSourceId: "PRIVATE SOURCE", files: [{ path: "example.c", text: "int example(void){return 1;}" }], questions: [] }, feedback: { ...current, privateSharedCodeRevision: "PRIVATE HASH" } }] } });
    const prompt = mocks.model.mock.calls[0][1];
    expect(prompt.systemPrompt).toContain("Run policy");
    expect(prompt.userPrompt).toContain("example.c");
    expect(prompt.userPrompt).not.toContain("PRIVATE");
  });
  it("fails closed on foreign references, revoked membership, and invalid model criterion sets", async () => {
    await expect(evaluateHomeworkWithAi({ ...context, pluginAttemptRef: "foreign" })).rejects.toMatchObject({ code: "HOMEWORK_SUBMISSION_CHANGED" });
    mocks.submission.mockResolvedValueOnce({ coreAttemptId: "attempt", metadata: {}, workspaceMemberId: "member", workspaceMember: { currentSubmissionId: "replacement" } });
    await expect(evaluateHomeworkWithAi(context)).rejects.toMatchObject({ code: "HOMEWORK_SUBMISSION_CHANGED" });
    mocks.model.mockResolvedValue(JSON.stringify({ noAnswerProvided: false, summary: "Invalid", criteria: [{ criterionId: "foreign", scorePercent: 80, feedback: "Wrong identity" }] }));
    await expect(evaluateHomeworkWithAi(context)).rejects.toMatchObject({ code: "AI_FEEDBACK_GENERATION_FAILED" });
    expect(mocks.artifact).not.toHaveBeenCalled();
  });
  it("keeps drafts pending and blocks release for missing weighted components", async () => {
    const feedback = await createHomeworkFeedbackDraft(context);
    expect(feedback.combinedScore).toBeNull();
    const row = { participantId: "student", score: 56, gradeSource: "regrade", feedback: { ...homeworkFeedbackDraft(policy, ["q1"]), codeScore: 80 }, gradingResult: {} } as const;
    const result = await homeworkGradeCompletions({ ...context, rows: [row] });
    expect(result.student).toEqual({ status: "partial", completedComponentCount: 1, requiredComponentCount: 2 });
    expect((await homeworkGradeCompletions({ ...context, rows: [{ ...row, gradeSource: "override" }] })).student.status).toBe("complete");
    const canonical = { ...row, feedback: { kind: "homework_rubric", details: row.feedback }, gradingResult: { studentFeedback: row.feedback } };
    expect((await homeworkGradeCompletions({ ...context, rows: [canonical] })).student.status).toBe("partial");
  });
});
