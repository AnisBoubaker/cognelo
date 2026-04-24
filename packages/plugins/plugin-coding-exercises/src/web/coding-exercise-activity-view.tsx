"use client";

import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { CodeEditor, MonacoCodeEditor, codeLanguageOptions } from "@cognelo/activity-ui";
import {
  buildCodingExerciseStudentTemplateProjectionFromSource,
  buildCodingExerciseStudentTemplateSource,
  buildCodingExerciseTemplateSource,
  codingExerciseTemplateInsertionToken,
  normalizeCodingExerciseSampleTests,
  parseCodingExerciseConfig,
  parseCodingExercisePrivateConfig,
  splitCodingExerciseTemplateSource,
  type CodingExerciseConfig,
  type CodingExerciseExecutionMode,
  type CodingExercisePrivateConfig
} from "../coding-exercises";
import { formatCodingExercisesMessage, normalizeCodingExercisesLocale, type CodingExercisesLocale } from "./messages";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  config?: Record<string, unknown>;
};

type HiddenTest = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  testCode: string;
  isEnabled: boolean;
  weight: number;
  orderIndex?: number;
};

type SampleTest = CodingExerciseConfig["sampleTests"][number];

type CodingExecution = {
  id: string;
  kind: "run" | "submit";
  status: "pending" | "completed" | "failed";
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  timeSeconds?: string | null;
  memoryKb?: number | null;
  judge0StatusLabel?: string | null;
  resultSummary?: Record<string, unknown>;
  createdAt: string;
};

type ReferenceValidationTestResult = {
  id: string;
  name: string;
  passed: boolean;
  weight: number;
  statusId?: number | null;
  statusLabel?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  message?: string | null;
  timeSeconds?: string | null;
  memoryKb?: number | null;
};

type ReferenceValidationGroup = {
  testCount?: number;
  passedCount?: number;
  tests?: ReferenceValidationTestResult[];
};

type CodingExerciseClient = {
  listHiddenTests: (
    courseId: string,
    activityId: string
  ) => Promise<{
    tests: HiddenTest[];
    referenceSolution: { sourceCode: string; privateConfig: CodingExercisePrivateConfig; validationSummary: Record<string, unknown> } | null;
  }>;
  saveHiddenTests: (
    courseId: string,
    activityId: string,
    input: { tests: HiddenTest[]; sampleTests: SampleTest[]; referenceSolution: string; privateConfig: CodingExercisePrivateConfig }
  ) => Promise<{
    tests: HiddenTest[];
    referenceSolution: { sourceCode: string; privateConfig: CodingExercisePrivateConfig; validationSummary: Record<string, unknown> } | null;
  }>;
  runCode: (
    courseId: string,
    activityId: string,
    input: { sourceCode: string; stdin?: string; expectedOutput?: string; testCode?: string }
  ) => Promise<{ execution: CodingExecution }>;
  listRuns: (courseId: string, activityId: string) => Promise<{ executions: CodingExecution[] }>;
  submitCode: (courseId: string, activityId: string, input: { sourceCode: string }) => Promise<{ execution: CodingExecution }>;
  listSubmissions: (courseId: string, activityId: string) => Promise<{ executions: CodingExecution[] }>;
};

type CodingExerciseActivityViewProps = {
  activity: ActivityLike;
  canManage: boolean;
  course?: { id?: string; title: string } | null;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<ActivityLike>;
  codingClient?: CodingExerciseClient;
  locale?: string;
};

const fallbackConfig: CodingExerciseConfig = {
  prompt: "",
  language: "python",
  executionMode: "program",
  starterCode: "",
  studentTemplateSource: "",
  sampleTests: [],
  maxEditorSeconds: 1800
};

const disabledCodingExerciseLanguages = new Set(["javascript"]);

export function CodingExerciseActivityView({
  activity,
  canManage,
  course,
  onSave,
  codingClient,
  locale
}: CodingExerciseActivityViewProps) {
  const pluginLocale = normalizeCodingExercisesLocale(locale);
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) =>
    formatCodingExercisesMessage(pluginLocale, key, values);
  const codingExerciseLanguageOptions = codeLanguageOptions.map((option) => ({
    ...option,
    disabled: disabledCodingExerciseLanguages.has(option.value)
  }));
  const previousActivityIdRef = useRef(activity.id);
  const [title, setTitle] = useState(activity.title);
  const [config, setConfig] = useState<CodingExerciseConfig>(() => parseCodingExerciseConfig(activity.config ?? fallbackConfig));
  const [hiddenTests, setHiddenTests] = useState<HiddenTest[]>([]);
  const [referenceSolution, setReferenceSolution] = useState("");
  const [privateConfig, setPrivateConfig] = useState<CodingExercisePrivateConfig>(() => parseCodingExercisePrivateConfig({}));
  const [referenceValidationSummary, setReferenceValidationSummary] = useState<Record<string, unknown> | null>(null);
  const [expandedSampleTestIds, setExpandedSampleTestIds] = useState<string[]>([]);
  const [expandedHiddenTestIds, setExpandedHiddenTestIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [editorCode, setEditorCode] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [sampleExpectedOutput, setSampleExpectedOutput] = useState("");
  const [sampleTestCode, setSampleTestCode] = useState("");
  const [selectedSampleTestId, setSelectedSampleTestId] = useState("");
  const [runExecution, setRunExecution] = useState<CodingExecution | null>(null);
  const [submitExecution, setSubmitExecution] = useState<CodingExecution | null>(null);
  const [recentRuns, setRecentRuns] = useState<CodingExecution[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<CodingExecution[]>([]);
  const [workingAction, setWorkingAction] = useState<"run" | "submit" | null>(null);
  const sampleValidationTests = getReferenceValidationTests(referenceValidationSummary, "sampleTests");
  const hiddenValidationTests = getReferenceValidationTests(referenceValidationSummary, "hiddenTests");
  const templateProjection =
    config.executionMode === "template"
      ? buildCodingExerciseStudentTemplateProjectionFromSource(config.studentTemplateSource)
      : null;

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("coding-exercise-spinner-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "coding-exercise-spinner-style";
    style.textContent = "@keyframes coding-exercise-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    const isNewActivity = previousActivityIdRef.current !== activity.id;
    const nextConfig = parseCodingExerciseConfig(activity.config ?? fallbackConfig);
    const sampleTests = normalizeCodingExerciseSampleTests(nextConfig.sampleTests);
    setTitle(activity.title);
    setConfig(nextConfig);
    setEditorCode(nextConfig.starterCode);
    setSelectedSampleTestId(sampleTests[0]?.id ?? "");
    setSampleInput(sampleTests[0]?.input ?? "");
    setSampleExpectedOutput(sampleTests[0]?.output ?? "");
    setSampleTestCode(sampleTests[0]?.testCode ?? "");
    setRunExecution(null);
    setSubmitExecution(null);
    if (isNewActivity) {
      setHiddenTests([]);
      setReferenceSolution("");
      setPrivateConfig(parseCodingExercisePrivateConfig({}));
      setReferenceValidationSummary(null);
      setExpandedSampleTestIds([]);
      setExpandedHiddenTestIds([]);
    }
    setSaveMessage("");
    setError("");
    previousActivityIdRef.current = activity.id;
  }, [activity]);

  useEffect(() => {
    if (!canManage || !course?.id || !codingClient) {
      return;
    }

    codingClient
      .listHiddenTests(course.id, activity.id)
      .then((result) => {
        setHiddenTests(result.tests);
        setReferenceSolution(result.referenceSolution?.sourceCode ?? "");
        setPrivateConfig(parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {}));
        setReferenceValidationSummary(result.referenceSolution?.validationSummary ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("loadHiddenTestsError")));
  }, [activity.id, canManage, course?.id]);

  useEffect(() => {
    if (!course?.id || !codingClient) {
      return;
    }

    Promise.all([codingClient.listRuns(course.id, activity.id), codingClient.listSubmissions(course.id, activity.id)])
      .then(([runs, submissions]) => {
        setRecentRuns(runs.executions);
        setRecentSubmissions(submissions.executions);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("loadHistoryError")));
  }, [activity.id, course?.id]);

  function updateSampleTest(index: number, field: keyof CodingExerciseConfig["sampleTests"][number], value: string) {
    setConfig((current) => {
      const next = [...normalizeCodingExerciseSampleTests(current.sampleTests)];
      const item = next[index];
      if (!item) {
        return current;
      }
      next[index] = { ...item, [field]: value };
      return { ...current, sampleTests: next };
    });
  }

  function addSampleTest() {
    const nextId = `sample-${normalizeCodingExerciseSampleTests(config.sampleTests).length + 1}`;
    setConfig((current) => ({
      ...current,
      sampleTests: [
        ...normalizeCodingExerciseSampleTests(current.sampleTests),
        {
          id: nextId,
          input: "",
          output: "",
          testCode: "",
          explanation: ""
        }
      ]
    }));
    setExpandedSampleTestIds((current) => [...current, nextId]);
  }

  function removeSampleTest(index: number) {
    setConfig((current) => ({
      ...current,
      sampleTests: normalizeCodingExerciseSampleTests(current.sampleTests).filter((_, currentIndex) => currentIndex !== index)
    }));
  }

  function updateHiddenTest(index: number, field: keyof HiddenTest, value: string | boolean | number) {
    setHiddenTests((current) =>
      current.map((test, currentIndex) => (currentIndex === index ? { ...test, [field]: value } : test))
    );
  }

  function addHiddenTest() {
    const nextId = `hidden-test-${hiddenTests.length + 1}`;
    setHiddenTests((current) => [
      ...current,
      {
        id: nextId,
        name: `Hidden test ${current.length + 1}`,
        stdin: "",
        expectedOutput: "",
        testCode: "",
        isEnabled: true,
        weight: 1,
        orderIndex: current.length
      }
    ]);
    setExpandedHiddenTestIds((current) => [...current, nextId]);
  }

  function applySampleTest(testId: string) {
    const selectedTest = normalizeCodingExerciseSampleTests(config.sampleTests).find((test) => test.id === testId);
    setSelectedSampleTestId(testId);
    setSampleInput(selectedTest?.input ?? "");
    setSampleExpectedOutput(selectedTest?.output ?? "");
    setSampleTestCode(selectedTest?.testCode ?? "");
  }

  function removeHiddenTest(index: number) {
    setHiddenTests((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function toggleTemplateVisibleLine(lineIndex: number) {
    setPrivateConfig((current) => {
      const visibleLineNumbers = current.templateVisibleLineNumbers.includes(lineIndex)
        ? current.templateVisibleLineNumbers.filter((value) => value !== lineIndex)
        : [...current.templateVisibleLineNumbers, lineIndex].sort((left, right) => left - right);

      return {
        ...current,
        templateVisibleLineNumbers: visibleLineNumbers
      };
    });
  }

  function toggleSampleTest(testId: string) {
    setExpandedSampleTestIds((current) =>
      current.includes(testId) ? current.filter((value) => value !== testId) : [...current, testId]
    );
  }

  function toggleHiddenTest(testId: string) {
    setExpandedHiddenTestIds((current) =>
      current.includes(testId) ? current.filter((value) => value !== testId) : [...current, testId]
    );
  }

  async function saveActivityAndHiddenTests(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const normalizedPrivateConfig = getPersistedPrivateConfig(privateConfig);

      if (
        config.executionMode === "template" &&
        !normalizedPrivateConfig.templateSource.includes(codingExerciseTemplateInsertionToken)
      ) {
        throw new Error(t("templateSourceMissingMarker"));
      }

      await onSave({
        title,
        description: config.prompt,
        config: {
          prompt: config.prompt,
          language: config.language,
          executionMode: config.executionMode,
          starterCode: config.starterCode,
          studentTemplateSource:
            config.executionMode === "template"
              ? buildCodingExerciseStudentTemplateSource(
                  normalizedPrivateConfig.templateSource,
                  normalizedPrivateConfig.templateVisibleLineNumbers,
                  config.language
                )
              : "",
          sampleTests: normalizeCodingExerciseSampleTests(config.sampleTests),
          maxEditorSeconds: config.maxEditorSeconds
        }
      });

      if (canManage && course?.id && codingClient) {
        const result = await codingClient.saveHiddenTests(course.id, activity.id, {
          tests: hiddenTests.map((test, index) => ({
            ...test,
            orderIndex: index
          })),
          sampleTests: normalizeCodingExerciseSampleTests(config.sampleTests),
          referenceSolution,
          privateConfig: normalizedPrivateConfig
        });
        setHiddenTests(result.tests);
        setReferenceSolution(result.referenceSolution?.sourceCode ?? "");
        setPrivateConfig(parseCodingExercisePrivateConfig(result.referenceSolution?.privateConfig ?? {}));
        setReferenceValidationSummary(result.referenceSolution?.validationSummary ?? null);
      }

      setSaveMessage(t("saved"));
    } catch (err) {
      if (isApiErrorLike(err) && err.code === "REFERENCE_SOLUTION_VALIDATION_FAILED") {
        const details = normalizeObject(err.details);
        const validationSummary = normalizeObject(details?.validationSummary);
        if (validationSummary) {
          setReferenceValidationSummary(validationSummary);
        }
      }
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function runCode() {
    if (!course?.id || !codingClient) {
      return;
    }
    setWorkingAction("run");
    setError("");
    try {
      const result = await codingClient.runCode(course.id, activity.id, {
        sourceCode: editorCode,
        stdin: sampleInput,
        expectedOutput: sampleExpectedOutput,
        testCode: sampleTestCode
      });
      setRunExecution(result.execution);
      const runs = await codingClient.listRuns(course.id, activity.id);
      setRecentRuns(runs.executions);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("runError"));
    } finally {
      setWorkingAction(null);
    }
  }

  async function submitCode() {
    if (!course?.id || !codingClient) {
      return;
    }
    setWorkingAction("submit");
    setError("");
    try {
      const result = await codingClient.submitCode(course.id, activity.id, {
        sourceCode: editorCode
      });
      setSubmitExecution(result.execution);
      const submissions = await codingClient.listSubmissions(course.id, activity.id);
      setRecentSubmissions(submissions.executions);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <section className="section stack">
      {canManage ? (
        <form className="stack" onSubmit={saveActivityAndHiddenTests}>
          <h2>{t("authoringTitle")}</h2>

          <div className="field">
            <label htmlFor="coding-title">{t("title")}</label>
            <input id="coding-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="coding-language">{t("language")}</label>
            <select
              id="coding-language"
              value={config.language}
              onChange={(event) => {
                const nextLanguage = event.target.value;
                if (disabledCodingExerciseLanguages.has(nextLanguage)) {
                  return;
                }
                setConfig((current) => ({ ...current, language: nextLanguage }));
              }}
            >
              {codingExerciseLanguageOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="coding-execution-mode">{t("executionMode")}</label>
            <select
              id="coding-execution-mode"
              value={config.executionMode}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  executionMode: event.target.value as CodingExerciseExecutionMode
                }))
              }
            >
              <option value="program">{t("executionModeProgram")}</option>
              <option value="function">{t("executionModeFunction")}</option>
              <option value="template">{t("executionModeTemplate")}</option>
            </select>
            <p className="muted" style={{ margin: 0 }}>
              {t("executionModeHelp")}
            </p>
          </div>

          <div className="field">
            <label htmlFor="coding-prompt">{t("prompt")}</label>
            <textarea
              id="coding-prompt"
              rows={5}
              value={config.prompt}
              onChange={(event) => setConfig((current) => ({ ...current, prompt: event.target.value }))}
            />
          </div>

          <div className="stack">
            <span>{t("starterCode")}</span>
            <CodeEditor
              value={config.starterCode}
              onChange={(value) => setConfig((current) => ({ ...current, starterCode: value }))}
              language={config.language}
              minHeight={220}
            />
          </div>

          <div className="stack">
            <span>{t("referenceSolution")}</span>
            <p className="muted" style={{ margin: 0 }}>
              {t("referenceSolutionHelp")}
            </p>
            <CodeEditor value={referenceSolution} onChange={setReferenceSolution} language={config.language} minHeight={220} />
            {referenceValidationSummary ? (
              <p className="muted" style={{ margin: 0 }}>
                {t("lastValidationSummary", {
                  passedCount: String(referenceValidationSummary.passedCount ?? 0),
                  testCount: String(referenceValidationSummary.testCount ?? 0)
                })}
              </p>
            ) : null}
          </div>

          <div className="stack">
            <span>{t("hiddenSupportCode")}</span>
            <p className="muted" style={{ margin: 0 }}>
              {t("hiddenSupportCodeHelp")}
            </p>
            <CodeEditor
              value={privateConfig.hiddenSupportCode}
              onChange={(value) => setPrivateConfig((current) => ({ ...current, hiddenSupportCode: value }))}
              language={config.language}
              minHeight={180}
            />
          </div>

          {config.executionMode === "template" ? (
            <div className="stack">
              <span>{t("templateSource")}</span>
              <p className="muted" style={{ margin: 0 }}>
                {t("templateSourceHelp")}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {t("templateVisibleLinesHelp")}
              </p>
              <CodeEditor
                value={privateConfig.templateSource || buildCodingExerciseTemplateSource("", "")}
                onChange={(value) =>
                  setPrivateConfig((current) => {
                    const nextTemplate = value || buildCodingExerciseTemplateSource("", "");
                    const templateParts = splitCodingExerciseTemplateSource(nextTemplate);
                    return {
                      ...current,
                      templateSource: nextTemplate,
                      templateVisibleLineNumbers: current.templateVisibleLineNumbers.filter(
                        (lineNumber) => lineNumber < nextTemplate.split("\n").length
                      ),
                      templatePrefix: templateParts.prefix,
                      templateSuffix: templateParts.suffix
                    };
                  })
                }
                language={config.language}
                getLineClassName={(lineIndex) =>
                  privateConfig.templateVisibleLineNumbers.includes(lineIndex)
                    ? "coding-exercise-template-line is-visible"
                    : "coding-exercise-template-line"
                }
                leftRail={renderTemplateVisibilityRail(
                  (privateConfig.templateSource || buildCodingExerciseTemplateSource("", "")).split("\n"),
                  privateConfig.templateVisibleLineNumbers,
                  toggleTemplateVisibleLine,
                  t
                )}
                leftRailWidth={20}
                minHeight={260}
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="coding-max-editor-seconds">{t("editorTimeLimit")}</label>
            <input
              id="coding-max-editor-seconds"
              type="number"
              min={30}
              max={14400}
              value={config.maxEditorSeconds}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  maxEditorSeconds: Number(event.target.value || "1800")
                }))
              }
            />
          </div>

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>{t("visibleSampleTests")}</h3>
              <button type="button" className="button secondary" onClick={addSampleTest}>
                {t("addSampleTest")}
              </button>
            </div>
            {normalizeCodingExerciseSampleTests(config.sampleTests).map((test, index) => (
              <section key={test.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
                <button
                  type="button"
                  onClick={() => toggleSampleTest(test.id)}
                  style={collapsibleHeaderStyle}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{expandedSampleTestIds.includes(test.id) ? "▾" : "▸"}</span>
                    <span>{getSampleTestSummary(test)}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ValidationBadge result={sampleValidationTests.get(test.id)} locale={pluginLocale} loading={saving} />
                  </span>
                </button>
                {expandedSampleTestIds.includes(test.id) ? (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="button secondary" onClick={() => removeSampleTest(index)}>
                        {t("remove")}
                      </button>
                    </div>
                    <div className="field">
                      <label>{t("input")}</label>
                      <textarea rows={3} value={test.input} onChange={(event) => updateSampleTest(index, "input", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("expectedOutput")}</label>
                      <textarea rows={3} value={test.output} onChange={(event) => updateSampleTest(index, "output", event.target.value)} />
                    </div>
                    <div className="stack">
                      <span>{t("testHarnessCode")}</span>
                      <p className="muted" style={{ margin: 0 }}>
                        {t("testHarnessCodeHelp")}
                      </p>
                      <CodeEditor
                        value={test.testCode}
                        onChange={(value) => updateSampleTest(index, "testCode", value)}
                        language={config.language}
                        minHeight={160}
                      />
                    </div>
                    <div className="field">
                      <label>{t("explanation")}</label>
                      <textarea
                        rows={2}
                        value={test.explanation}
                        onChange={(event) => updateSampleTest(index, "explanation", event.target.value)}
                      />
                    </div>
                    {renderHiddenTestValidation(test.id, sampleValidationTests.get(test.id), pluginLocale)}
                  </>
                ) : null}
              </section>
            ))}
          </section>

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>{t("hiddenTests")}</h3>
              <button type="button" className="button secondary" onClick={addHiddenTest}>
                {t("addHiddenTest")}
              </button>
            </div>
            <p className="muted">{t("hiddenTestsHelp")}</p>
            {hiddenTests.map((test, index) => (
              <section key={test.id} className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
                <button
                  type="button"
                  onClick={() => toggleHiddenTest(test.id)}
                  style={collapsibleHeaderStyle}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{expandedHiddenTestIds.includes(test.id) ? "▾" : "▸"}</span>
                    <span>{test.name}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ValidationBadge
                      result={test.isEnabled ? hiddenValidationTests.get(test.id) : undefined}
                      locale={pluginLocale}
                      loading={saving && test.isEnabled}
                    />
                  </span>
                </button>
                {expandedHiddenTestIds.includes(test.id) ? (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="button secondary" onClick={() => removeHiddenTest(index)}>
                        {t("remove")}
                      </button>
                    </div>
                    <div className="field">
                      <label>{t("name")}</label>
                      <input value={test.name} onChange={(event) => updateHiddenTest(index, "name", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("stableId")}</label>
                      <input value={test.id} onChange={(event) => updateHiddenTest(index, "id", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("input")}</label>
                      <textarea rows={3} value={test.stdin} onChange={(event) => updateHiddenTest(index, "stdin", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>{t("expectedOutput")}</label>
                      <textarea
                        rows={3}
                        value={test.expectedOutput}
                        onChange={(event) => updateHiddenTest(index, "expectedOutput", event.target.value)}
                      />
                    </div>
                    <div className="stack">
                      <span>{t("testHarnessCode")}</span>
                      <p className="muted" style={{ margin: 0 }}>
                        {t("testHarnessCodeHelp")}
                      </p>
                      <CodeEditor
                        value={test.testCode}
                        onChange={(value) => updateHiddenTest(index, "testCode", value)}
                        language={config.language}
                        minHeight={160}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        alignItems: "start"
                      }}
                    >
                      <div className="field">
                        <label htmlFor={`hidden-test-enabled-${index}`}>{t("enabled")}</label>
                        <div
                          style={{
                            alignItems: "center",
                            display: "flex",
                            minHeight: 42
                          }}
                        >
                          <input
                            id={`hidden-test-enabled-${index}`}
                            type="checkbox"
                            checked={test.isEnabled}
                            onChange={(event) => updateHiddenTest(index, "isEnabled", event.target.checked)}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor={`hidden-test-weight-${index}`}>{t("weight")}</label>
                        <input
                          id={`hidden-test-weight-${index}`}
                          type="number"
                          min={1}
                          max={100}
                          value={test.weight}
                          onChange={(event) => updateHiddenTest(index, "weight", Number(event.target.value || "1"))}
                          style={{ maxWidth: 120 }}
                        />
                      </div>
                    </div>
                    {renderHiddenTestValidation(test.id, hiddenValidationTests.get(test.id), pluginLocale)}
                  </>
                ) : null}
              </section>
            ))}
          </section>

          {error ? <p className="error">{error}</p> : null}
          {saveMessage ? <p className="muted">{saveMessage}</p> : null}

          <div className="row">
            <button type="submit" disabled={saving}>
              {saving ? t("saving") : t("saveCodingExercise")}
            </button>
          </div>
        </form>
      ) : (
        <div className="stack">
          <h2>{activity.title}</h2>
          <p>{config.prompt}</p>
          {config.executionMode === "template" ? (
            <MonacoCodeEditor
              id={`coding-exercise-student-${activity.id}`}
              ariaLabel={activity.title || t("starterCode")}
              value={editorCode}
              onChange={setEditorCode}
              language={config.language}
              minHeight={360}
              readOnlyPrefix={templateProjection?.readOnlyPrefix}
              readOnlySuffix={templateProjection?.readOnlySuffix}
            />
          ) : (
          <MonacoCodeEditor
            id={`coding-exercise-student-${activity.id}`}
            ariaLabel={activity.title || t("starterCode")}
            value={editorCode}
            onChange={setEditorCode}
            language={config.language}
            minHeight={360}
          />
          )}

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <h3>{t("sampleRun")}</h3>
            {normalizeCodingExerciseSampleTests(config.sampleTests).length ? (
              <div className="field">
                <label htmlFor="coding-visible-sample">{t("visibleSampleTests")}</label>
                <select
                  id="coding-visible-sample"
                  value={selectedSampleTestId}
                  onChange={(event) => applySampleTest(event.target.value)}
                >
                  {normalizeCodingExerciseSampleTests(config.sampleTests).map((test) => (
                    <option key={test.id} value={test.id}>
                      {getSampleTestSummary(test)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="field">
              <label>{t("sampleInput")}</label>
              <textarea rows={4} value={sampleInput} onChange={(event) => setSampleInput(event.target.value)} />
            </div>
            <div className="field">
              <label>{t("expectedOutput")}</label>
              <textarea rows={4} value={sampleExpectedOutput} onChange={(event) => setSampleExpectedOutput(event.target.value)} />
            </div>
            <div className="stack">
              <span>{t("testHarnessCode")}</span>
              <p className="muted" style={{ margin: 0 }}>
                {t("visibleTestHarnessHelp")}
              </p>
              <CodeEditor value={sampleTestCode} onChange={setSampleTestCode} language={config.language} minHeight={160} />
            </div>
            <div className="row">
              <button type="button" onClick={runCode} disabled={workingAction === "run"}>
                {workingAction === "run" ? t("running") : t("runSampleTest")}
              </button>
              <button type="button" onClick={submitCode} disabled={workingAction === "submit"}>
                {workingAction === "submit" ? t("submitting") : t("submitForGrading")}
              </button>
            </div>
          </section>

          {error ? <p className="error">{error}</p> : null}

          {runExecution ? <ExecutionCard execution={runExecution} title={t("latestSampleRun")} locale={pluginLocale} /> : null}
          {submitExecution ? <ExecutionCard execution={submitExecution} title={t("latestSubmission")} locale={pluginLocale} /> : null}

          {recentRuns.length ? (
            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <h3>{t("recentRuns")}</h3>
              {recentRuns.map((execution) => (
                <ExecutionCard
                  key={execution.id}
                  execution={execution}
                  title={new Date(execution.createdAt).toLocaleString(pluginLocale)}
                  compact
                  locale={pluginLocale}
                />
              ))}
            </section>
          ) : null}

          {recentSubmissions.length ? (
            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <h3>{t("recentSubmissions")}</h3>
              {recentSubmissions.map((execution) => (
                <ExecutionCard
                  key={execution.id}
                  execution={execution}
                  title={new Date(execution.createdAt).toLocaleString(pluginLocale)}
                  compact
                  locale={pluginLocale}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getPersistedPrivateConfig(privateConfig: CodingExercisePrivateConfig): CodingExercisePrivateConfig {
  const templateSource =
    typeof privateConfig.templateSource === "string" && privateConfig.templateSource.length > 0
      ? privateConfig.templateSource
      : buildCodingExerciseTemplateSource(privateConfig.templatePrefix ?? "", privateConfig.templateSuffix ?? "");
  const templateParts = splitCodingExerciseTemplateSource(templateSource);
  const lineCount = templateSource.split("\n").length;
  const templateVisibleLineNumbers = privateConfig.templateVisibleLineNumbers
    .filter((lineNumber) => Number.isInteger(lineNumber) && lineNumber >= 0 && lineNumber < lineCount)
    .sort((left, right) => left - right);

  return {
    ...privateConfig,
    templateSource,
    templateVisibleLineNumbers,
    templatePrefix: templateParts.prefix,
    templateSuffix: templateParts.suffix
  };
}

function isApiErrorLike(value: unknown): value is { code?: string; details?: unknown } {
  return value instanceof Error && "code" in value;
}

function getReferenceValidationTests(summary: Record<string, unknown> | null, groupKey: "sampleTests" | "hiddenTests") {
  const group = normalizeObject(summary?.[groupKey]) as ReferenceValidationGroup | null;
  const tests = Array.isArray(group?.tests) ? group.tests : [];
  const testMap = new Map<string, ReferenceValidationTestResult>();

  for (const test of tests) {
    if (!test || typeof test !== "object" || Array.isArray(test)) {
      continue;
    }
    const id = "id" in test && typeof test.id === "string" ? test.id : null;
    if (!id) {
      continue;
    }
    testMap.set(id, test as ReferenceValidationTestResult);
  }

  return testMap;
}

function getSampleTestSummary(test: SampleTest) {
  return test.explanation.trim() || test.id;
}

function renderTemplateVisibilityRail(
  templateLines: string[],
  visibleLineNumbers: number[],
  toggleTemplateVisibleLine: (lineIndex: number) => void,
  t: (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) => string
) {
  const visibleLines = new Set(visibleLineNumbers);

  return (
    <div className="parsons-editor-rail parsons-editor-selection-rail">
      {templateLines.map((_, lineIndex) => {
        const selected = visibleLines.has(lineIndex);
        const isStudentInsertionLine = templateLines[lineIndex]?.includes(codingExerciseTemplateInsertionToken);
        return (
          <button
            key={`template-visible-line-${lineIndex}`}
            type="button"
            aria-label={t("templateVisibleLine", { line: lineIndex + 1 })}
            title={t("templateVisibleLine", { line: lineIndex + 1 })}
            disabled={isStudentInsertionLine}
            onClick={() => toggleTemplateVisibleLine(lineIndex)}
            className={`parsons-line-marker ${selected ? "is-selected" : ""} ${isStudentInsertionLine ? "is-disabled" : ""}`}
          />
        );
      })}
    </div>
  );
}

function ValidationBadge({
  result,
  locale,
  loading = false
}: {
  result?: ReferenceValidationTestResult;
  locale: CodingExercisesLocale;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span
        aria-label={formatCodingExercisesMessage(locale, "saving")}
        style={{
          animation: "coding-exercise-spin 0.8s linear infinite",
          border: "2px solid rgba(13, 27, 71, 0.15)",
          borderRadius: "50%",
          borderTopColor: "#0d1b47",
          boxSizing: "border-box",
          display: "inline-block",
          height: 16,
          width: 16
        }}
      />
    );
  }

  if (!result) {
    return null;
  }

  return (
    <span
      aria-label={result.passed ? formatCodingExercisesMessage(locale, "passed") : formatCodingExercisesMessage(locale, "failed")}
      style={{
        color: result.passed ? "#157347" : "#b42318",
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1
      }}
    >
      {result.passed ? "✓" : "✕"}
    </span>
  );
}

const collapsibleHeaderStyle: CSSProperties = {
  alignItems: "center",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  padding: 0,
  textAlign: "left",
  width: "100%"
};

function renderHiddenTestValidation(testId: string, testResult: ReferenceValidationTestResult | undefined, locale: CodingExercisesLocale) {
  if (!testResult || testResult.passed) {
    return null;
  }

  const detailBlocks = [
    { label: formatCodingExercisesMessage(locale, "compilerOutput"), value: testResult.compileOutput },
    { label: formatCodingExercisesMessage(locale, "runtimeError"), value: testResult.stderr },
    { label: formatCodingExercisesMessage(locale, "judgeMessage"), value: testResult.message },
    { label: formatCodingExercisesMessage(locale, "programOutput"), value: testResult.stdout }
  ].filter((item) => item.value && item.value.trim().length > 0);

  return (
    <section
      key={`${testId}-validation`}
      className="stack"
      style={{
        background: "rgba(186, 26, 26, 0.05)",
        border: "1px solid rgba(186, 26, 26, 0.18)",
        borderRadius: 10,
        padding: 12
      }}
    >
      <strong style={{ color: "#8f1d1d" }}>
        {formatCodingExercisesMessage(locale, "validationFailed")}
        {testResult.statusLabel ? `: ${testResult.statusLabel}` : ""}
      </strong>
      {detailBlocks.length ? (
        detailBlocks.map((item) => (
          <div key={item.label} className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
            <pre
              style={{
                background: "rgba(13, 27, 71, 0.04)",
                borderRadius: 8,
                margin: 0,
                overflowX: "auto",
                padding: 10,
                whiteSpace: "pre-wrap"
              }}
            >
              {item.value}
            </pre>
          </div>
        ))
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {formatCodingExercisesMessage(locale, "referenceSolutionFailedHiddenTest")}
        </p>
      )}
    </section>
  );
}

function ExecutionCard({
  execution,
  title,
  compact = false,
  locale
}: {
  execution: CodingExecution;
  title: string;
  compact?: boolean;
  locale: CodingExercisesLocale;
}) {
  const testSummary = execution.resultSummary?.tests;
  const tests = Array.isArray(testSummary) ? testSummary : [];
  return (
    <section className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>{title}</strong>
        <span className="muted">
          {formatExecutionStatus(locale, execution.status)} {execution.judge0StatusLabel ? `· ${execution.judge0StatusLabel}` : ""}
        </span>
      </div>
      {execution.stdout ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "stdout")}</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stdout}</pre>
        </div>
      ) : null}
      {execution.stderr ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "stderr")}</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stderr}</pre>
        </div>
      ) : null}
      {execution.compileOutput ? (
        <div className="field">
          <label>{formatCodingExercisesMessage(locale, "compileOutput")}</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.compileOutput}</pre>
        </div>
      ) : null}
      {execution.message ? <p className="muted">{execution.message}</p> : null}
      {tests.length && !compact ? (
        <div className="stack">
          <strong>{formatCodingExercisesMessage(locale, "hiddenTestResults")}</strong>
          {tests.map((test) => {
            const item = test as Record<string, unknown>;
            return (
              <div key={String(item.id ?? item.name)} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <span>{String(item.name ?? item.id ?? formatCodingExercisesMessage(locale, "test"))}</span>
                <span className="muted">
                  {item.passed
                    ? formatCodingExercisesMessage(locale, "passed").toLowerCase()
                    : formatCodingExercisesMessage(locale, "failed").toLowerCase()}{" "}
                  {item.statusLabel ? `· ${String(item.statusLabel)}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function formatExecutionStatus(locale: CodingExercisesLocale, status: CodingExecution["status"]) {
  if (status === "completed") {
    return formatCodingExercisesMessage(locale, "statusCompleted");
  }
  if (status === "failed") {
    return formatCodingExercisesMessage(locale, "statusFailed");
  }
  return formatCodingExercisesMessage(locale, "statusPending");
}
