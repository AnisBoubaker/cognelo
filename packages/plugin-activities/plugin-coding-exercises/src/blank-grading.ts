import { AppError } from "@cognelo/core";
import { assembleCodingBlankSource, codingBlankAnswer, codingBlankIds, type CodingBlankAnswers, type CodingBlankOutcome, type CodingBlankGrading } from "./code-blanks";

/** Execution stays in the caller's sandbox adapter; this policy never persists substituted source. */
export async function gradeCodingBlanks<T extends { summary: { accepted: boolean | null } }, Source = string>(input: {
  template: string; answers: CodingBlankAnswers; referenceAnswers: CodingBlankAnswers;
  assembleSource?: (answers: CodingBlankAnswers) => Source;
  sourceKey?: (source: Source) => string;
  checkSyntax?: (source: Source) => Promise<boolean>;
  runSuite: (source: Source, stopAfterFailure: boolean) => Promise<T>;
}) {
  const ids = codingBlankIds(input.template);
  if (!ids.length) throw new AppError(409, "CODING_EXERCISE_BLANKS_REQUIRED", "This exercise has no code blanks to grade.");
  const outcomes: CodingBlankOutcome[] = ids.map((id, index) => ({ id, number: index + 1,
    answered: codingBlankAnswer(input.answers, id).trim().length > 0, correct: false }));
  const answered = outcomes.filter(outcome => outcome.answered);
  const grading: CodingBlankGrading = { policy: "isolated-blanks-v1", method: "empty", total: ids.length,
    answered: answered.length, correct: 0, combinedPassed: false, syntaxPassed: null, outcomes };
  let combined: T | null = null;
  if (!answered.length) return { grading, combined, reviewRequired: false };
  if (ids.some(id => !Object.hasOwn(input.referenceAnswers, id))) {
    throw new AppError(409, "CODING_EXERCISE_BLANK_REFERENCE_REQUIRED", "A teacher reference completion is required for every code blank.");
  }
  const repairedAnswers = Object.fromEntries(outcomes.map(outcome => [outcome.id,
    codingBlankAnswer(outcome.answered ? input.answers : input.referenceAnswers, outcome.id)]));
  const assemble = input.assembleSource ?? ((answers: CodingBlankAnswers) => assembleCodingBlankSource(input.template, answers) as Source);
  const sourceKey = input.sourceKey ?? ((source: Source) => typeof source === "string" ? source : JSON.stringify(source));
  const repairedSource = assemble(repairedAnswers);
  const suites = new Map<string, Promise<T>>();
  const runSuite = (source: Source, stopAfterFailure: boolean) => {
    let promise = suites.get(sourceKey(source));
    if (!promise) { promise = input.runSuite(source, stopAfterFailure); suites.set(sourceKey(source), promise); }
    return promise;
  };
  grading.syntaxPassed = input.checkSyntax ? await input.checkSyntax(repairedSource) : null;
  if (grading.syntaxPassed !== false) combined = await runSuite(repairedSource, false);
  if (combined?.summary.accepted === true) {
    grading.method = "combined";
    grading.combinedPassed = true;
    for (const outcome of answered) outcome.correct = true;
  } else {
    grading.method = "isolated";
    let cursor = 0;
    let failure: { error: unknown } | undefined;
    const worker = async () => {
      while (cursor < answered.length && failure === undefined) {
        const outcome = answered[cursor++];
        try {
          const source = assemble({ ...input.referenceAnswers,
            [outcome.id]: codingBlankAnswer(input.answers, outcome.id) });
          // A syntax-invalid combined source cannot pass when the isolated variant is identical.
          if (sourceKey(source) === sourceKey(repairedSource) && grading.syntaxPassed === false) continue;
          outcome.correct = (await runSuite(source, true)).summary.accepted === true;
        } catch (error) { failure = { error }; }
      }
    };
    // Bound added load; identical variants share their result within this grading operation.
    await Promise.all(Array.from({ length: Math.min(2, answered.length) }, worker));
    if (failure !== undefined) throw failure.error;
  }
  grading.correct = outcomes.filter(outcome => outcome.correct).length;
  const reviewRequired = !grading.combinedPassed && grading.correct === grading.total;
  return { grading, combined, reviewRequired };
}
