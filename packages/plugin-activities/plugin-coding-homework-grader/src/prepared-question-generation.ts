import type { CurrentUser } from "@cognelo/contracts";
import { NonRetryableBackgroundJobError, generateAiAgentText } from "@cognelo/core";
import { createHomeworkReferenceSearch } from "./prepared-reference-search";
import { selectLearnerFunctions, cSourceFingerprint, unchangedProvidedFunctionNames } from "./provided-code";
import { parseChallengeQuestionResponse } from "./question-response";
import { homeworkQuestionSystemPrompt, type HomeworkQuestionLanguage } from "./question-generation-policy";
import { makeStudentQuestionContext, type StudentQuestionContext } from "./question-context";
import { parseCodingHomeworkSourceFiles } from "./parsers";

export async function generatePreparedHomeworkQuestions(input: {
  scope: { user: CurrentUser; courseId: string; groupId?: string };
  sources: Array<{ path: string; languageKey: string; content: string }>;
  providedCode: Parameters<typeof selectLearnerFunctions>[1];
  settings: Record<string, unknown>;
  referenceSnapshot: Record<string, unknown>;
  questionLanguage: HomeworkQuestionLanguage;
  connection: Parameters<typeof generateAiAgentText>[0];
  signal?: AbortSignal;
  checkCurrent?: () => Promise<void>;
}) {
  const { scope, sources, providedCode, settings, referenceSnapshot, questionLanguage, connection, signal } = input;
  const leaseIsCurrent = async () => { signal?.throwIfAborted(); await input.checkCurrent?.(); };
  await leaseIsCurrent();
  const parsed = await parseCodingHomeworkSourceFiles(sources);
  const comparison = selectLearnerFunctions(parsed.functions, providedCode);
  const candidates = comparison.eligible.slice(0, Math.max(1, Math.min(50, Number(settings.candidateLimit ?? 5))));
  const fallbackSources = sources.filter(file => !providedCode.files.includes(cSourceFingerprint(file.content)));
  if (!candidates.length && (parsed.functions.length > 0 || providedCode.functions.length > 0 || !fallbackSources.length)) {
    throw new NonRetryableBackgroundJobError("No new or modified function could be identified for challenge questions. Unchanged teacher-provided code is excluded; review the student's implementation before requesting a new submission.", "HOMEWORK_NO_ELIGIBLE_CODE");
  }
  const snapshot = referenceSnapshot;
  const indexes = Array.isArray(snapshot.indexIds) ? snapshot.indexIds.filter((id): id is string => typeof id === "string") : [];
  const search = await createHomeworkReferenceSearch(scope, snapshot);
  const questionCount = Math.max(1, Math.min(20, Number(settings.questionCount ?? 3)));
  const generated: Array<{ text: string; functionIndex: number | null; matches: unknown[]; context: StudentQuestionContext }> = [];
  const systemPrompt = homeworkQuestionSystemPrompt(questionLanguage, String(settings.generationInstructions ?? ""));
  const fallbackSource = candidates.length ? "" : fallbackSources.map(file => `${file.path}\n${file.content}`).join("\n");
  for (let index = 0; index < questionCount; index++) {
    await leaseIsCurrent();
    const functionIndex = candidates.length ? index % candidates.length : null;
    const candidate = functionIndex !== null ? candidates[functionIndex] : null;
    const source = candidate?.functionCode ?? fallbackSource.slice(0, 20_000);
    const matches = indexes.length ? await search.search(source.slice(0, 1800) || String(settings.promptMarkdown).slice(0, 1800), Number(settings.retrievedExampleCount ?? 3), signal) : [];
    const context = makeStudentQuestionContext({ code: source, filePath: candidate?.sourcePath, functionName: candidate?.functionName, truncated: !candidate && fallbackSource.length > 20_000, languageKey: String(settings.languageKey ?? "c") });
    const excludedNames = unchangedProvidedFunctionNames(providedCode, comparison.eligible);
    const questionRequest = { excludedProvidedFunctionNames: excludedNames.slice(0, 100), assignment: settings.promptMarkdown, submittedFunction: candidate?.functionName,
      submittedFile: candidate?.sourcePath, submittedCode: context.code, privateReferenceContext: matches.map(match => ({ title: match.title, text: match.text })),
      questionNumber: index + 1, totalQuestions: questionCount, previousQuestions: generated.map(question => question.text) };
    let questionText = "";
    let correction: { previousResponse: string; feedback: string } | undefined;
    const rejected: string[] = [];
    for (let retry = 0; retry < 3 && !questionText; retry++) {
      await leaseIsCurrent();
      const userPrompt = JSON.stringify({ ...questionRequest, ...(correction ? { correction } : {}) });
      const output = await generateAiAgentText(connection, { systemPrompt, userPrompt, maxOutputTokens: 1200, ...(signal ? { signal } : {}) });
      const result = parseChallengeQuestionResponse(output, { excludedNames, targetFunction: candidate?.functionName, previousQuestions: questionRequest.previousQuestions });
      if (result.ok) questionText = result.text;
      else { rejected.push(result.reason); correction = { previousResponse: output.slice(0, 4000), feedback: result.feedback }; }
    }
    if (!questionText) throw new NonRetryableBackgroundJobError(`Question ${index + 1} could not be generated after 3 attempts (${rejected.join(", ")}). ${correction?.feedback ?? "The model response was invalid."}`, "HOMEWORK_QUESTION_INVALID");
    generated.push({ text: questionText, functionIndex, matches, context });
  }
  await leaseIsCurrent();
  return { candidates, generated, parserDiagnostics: parsed.diagnostics, excludedProvidedFunctionCount: comparison.excluded.length };
}
