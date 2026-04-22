"use client";

import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { CodeEditor, codeLanguageOptions } from "@cognelo/activity-ui";
import { normalizeCodingExerciseSampleTests, parseCodingExerciseConfig, type CodingExerciseConfig } from "../coding-exercises";

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
  ) => Promise<{ tests: HiddenTest[]; referenceSolution: { sourceCode: string; validationSummary: Record<string, unknown> } | null }>;
  saveHiddenTests: (
    courseId: string,
    activityId: string,
    input: { tests: HiddenTest[]; sampleTests: SampleTest[]; referenceSolution: string }
  ) => Promise<{ tests: HiddenTest[]; referenceSolution: { sourceCode: string; validationSummary: Record<string, unknown> } | null }>;
  runCode: (
    courseId: string,
    activityId: string,
    input: { sourceCode: string; stdin?: string; expectedOutput?: string }
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
};

const fallbackConfig: CodingExerciseConfig = {
  prompt: "",
  language: "python",
  starterCode: "",
  sampleTests: [],
  maxEditorSeconds: 1800
};

export function CodingExerciseActivityView({
  activity,
  canManage,
  course,
  onSave,
  codingClient
}: CodingExerciseActivityViewProps) {
  const previousActivityIdRef = useRef(activity.id);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [config, setConfig] = useState<CodingExerciseConfig>(() => parseCodingExerciseConfig(activity.config ?? fallbackConfig));
  const [hiddenTests, setHiddenTests] = useState<HiddenTest[]>([]);
  const [referenceSolution, setReferenceSolution] = useState("");
  const [referenceValidationSummary, setReferenceValidationSummary] = useState<Record<string, unknown> | null>(null);
  const [expandedSampleTestIds, setExpandedSampleTestIds] = useState<string[]>([]);
  const [expandedHiddenTestIds, setExpandedHiddenTestIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [editorCode, setEditorCode] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [sampleExpectedOutput, setSampleExpectedOutput] = useState("");
  const [runExecution, setRunExecution] = useState<CodingExecution | null>(null);
  const [submitExecution, setSubmitExecution] = useState<CodingExecution | null>(null);
  const [recentRuns, setRecentRuns] = useState<CodingExecution[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<CodingExecution[]>([]);
  const [workingAction, setWorkingAction] = useState<"run" | "submit" | null>(null);
  const sampleValidationTests = getReferenceValidationTests(referenceValidationSummary, "sampleTests");
  const hiddenValidationTests = getReferenceValidationTests(referenceValidationSummary, "hiddenTests");

  useEffect(() => {
    const isNewActivity = previousActivityIdRef.current !== activity.id;
    const nextConfig = parseCodingExerciseConfig(activity.config ?? fallbackConfig);
    const sampleTests = normalizeCodingExerciseSampleTests(nextConfig.sampleTests);
    setTitle(activity.title);
    setDescription(activity.description);
    setConfig(nextConfig);
    setEditorCode(nextConfig.starterCode);
    setSampleInput(sampleTests[0]?.input ?? "");
    setSampleExpectedOutput(sampleTests[0]?.output ?? "");
    setRunExecution(null);
    setSubmitExecution(null);
    if (isNewActivity) {
      setHiddenTests([]);
      setReferenceSolution("");
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
        setReferenceValidationSummary(result.referenceSolution?.validationSummary ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load hidden tests."));
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
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load coding exercise history."));
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
        isEnabled: true,
        weight: 1,
        orderIndex: current.length
      }
    ]);
    setExpandedHiddenTestIds((current) => [...current, nextId]);
  }

  function removeHiddenTest(index: number) {
    setHiddenTests((current) => current.filter((_, currentIndex) => currentIndex !== index));
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
      await onSave({
        title,
        description,
        config: {
          prompt: config.prompt,
          language: config.language,
          starterCode: config.starterCode,
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
          referenceSolution
        });
        setHiddenTests(result.tests);
        setReferenceSolution(result.referenceSolution?.sourceCode ?? "");
        setReferenceValidationSummary(result.referenceSolution?.validationSummary ?? null);
      }

      setSaveMessage("Coding exercise saved.");
    } catch (err) {
      if (isApiErrorLike(err) && err.code === "REFERENCE_SOLUTION_VALIDATION_FAILED") {
        const details = normalizeObject(err.details);
        const validationSummary = normalizeObject(details?.validationSummary);
        if (validationSummary) {
          setReferenceValidationSummary(validationSummary);
        }
      }
      setError(err instanceof Error ? err.message : "Unable to save the coding exercise right now.");
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
        expectedOutput: sampleExpectedOutput
      });
      setRunExecution(result.execution);
      const runs = await codingClient.listRuns(course.id, activity.id);
      setRecentRuns(runs.executions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run code right now.");
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
      setError(err instanceof Error ? err.message : "Unable to submit code right now.");
    } finally {
      setWorkingAction(null);
    }
  }

  return (
    <section className="section stack">
      {canManage ? (
        <form className="stack" onSubmit={saveActivityAndHiddenTests}>
          <h2>Coding exercise authoring</h2>

          <div className="field">
            <label htmlFor="coding-title">Title</label>
            <input id="coding-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="coding-description">Description</label>
            <textarea id="coding-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="coding-language">Language</label>
            <select
              id="coding-language"
              value={config.language}
              onChange={(event) => setConfig((current) => ({ ...current, language: event.target.value }))}
            >
              {codeLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="coding-prompt">Prompt</label>
            <textarea
              id="coding-prompt"
              rows={5}
              value={config.prompt}
              onChange={(event) => setConfig((current) => ({ ...current, prompt: event.target.value }))}
            />
          </div>

          <div className="stack">
            <span>Starter code</span>
            <CodeEditor
              value={config.starterCode}
              onChange={(value) => setConfig((current) => ({ ...current, starterCode: value }))}
              language={config.language}
              minHeight={220}
            />
          </div>

          <div className="stack">
            <span>Reference solution</span>
            <p className="muted" style={{ margin: 0 }}>
              Teacher-only answer key. Hidden tests are validated against this code before they are saved.
            </p>
            <CodeEditor value={referenceSolution} onChange={setReferenceSolution} language={config.language} minHeight={220} />
            {referenceValidationSummary ? (
              <p className="muted" style={{ margin: 0 }}>
                Last validation: {String(referenceValidationSummary.passedCount ?? 0)}/{String(referenceValidationSummary.testCount ?? 0)} hidden tests passed.
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="coding-max-editor-seconds">Editor time limit (seconds)</label>
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
              <h3>Visible sample tests</h3>
              <button type="button" className="button secondary" onClick={addSampleTest}>
                Add sample test
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
                    <ValidationBadge result={sampleValidationTests.get(test.id)} />
                  </span>
                </button>
                {expandedSampleTestIds.includes(test.id) ? (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="button secondary" onClick={() => removeSampleTest(index)}>
                        Remove
                      </button>
                    </div>
                    <div className="field">
                      <label>Input</label>
                      <textarea rows={3} value={test.input} onChange={(event) => updateSampleTest(index, "input", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Expected output</label>
                      <textarea rows={3} value={test.output} onChange={(event) => updateSampleTest(index, "output", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Explanation</label>
                      <textarea
                        rows={2}
                        value={test.explanation}
                        onChange={(event) => updateSampleTest(index, "explanation", event.target.value)}
                      />
                    </div>
                    {renderHiddenTestValidation(test.id, sampleValidationTests.get(test.id))}
                  </>
                ) : null}
              </section>
            ))}
          </section>

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3>Hidden tests</h3>
              <button type="button" className="button secondary" onClick={addHiddenTest}>
                Add hidden test
              </button>
            </div>
            <p className="muted">Hidden tests are stored in plugin-owned tables and are not exposed to students.</p>
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
                    <ValidationBadge result={test.isEnabled ? hiddenValidationTests.get(test.id) : undefined} />
                  </span>
                </button>
                {expandedHiddenTestIds.includes(test.id) ? (
                  <>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button type="button" className="button secondary" onClick={() => removeHiddenTest(index)}>
                        Remove
                      </button>
                    </div>
                    <div className="field">
                      <label>Name</label>
                      <input value={test.name} onChange={(event) => updateHiddenTest(index, "name", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Stable id</label>
                      <input value={test.id} onChange={(event) => updateHiddenTest(index, "id", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Input</label>
                      <textarea rows={3} value={test.stdin} onChange={(event) => updateHiddenTest(index, "stdin", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Expected output</label>
                      <textarea
                        rows={3}
                        value={test.expectedOutput}
                        onChange={(event) => updateHiddenTest(index, "expectedOutput", event.target.value)}
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
                        <label htmlFor={`hidden-test-enabled-${index}`}>Enabled</label>
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
                        <label htmlFor={`hidden-test-weight-${index}`}>Weight</label>
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
                    {renderHiddenTestValidation(test.id, hiddenValidationTests.get(test.id))}
                  </>
                ) : null}
              </section>
            ))}
          </section>

          {error ? <p className="error">{error}</p> : null}
          {saveMessage ? <p className="muted">{saveMessage}</p> : null}

          <div className="row">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save coding exercise"}
            </button>
          </div>
        </form>
      ) : (
        <div className="stack">
          <h2>{activity.title}</h2>
          {activity.description ? <p className="muted">{activity.description}</p> : null}
          <p>{config.prompt}</p>
          <CodeEditor value={editorCode} onChange={setEditorCode} language={config.language} minHeight={260} />

          <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
            <h3>Sample run</h3>
            <div className="field">
              <label>Sample input</label>
              <textarea rows={4} value={sampleInput} onChange={(event) => setSampleInput(event.target.value)} />
            </div>
            <div className="field">
              <label>Expected output</label>
              <textarea rows={4} value={sampleExpectedOutput} onChange={(event) => setSampleExpectedOutput(event.target.value)} />
            </div>
            <div className="row">
              <button type="button" onClick={runCode} disabled={workingAction === "run"}>
                {workingAction === "run" ? "Running..." : "Run sample test"}
              </button>
              <button type="button" onClick={submitCode} disabled={workingAction === "submit"}>
                {workingAction === "submit" ? "Submitting..." : "Submit for grading"}
              </button>
            </div>
          </section>

          {error ? <p className="error">{error}</p> : null}

          {runExecution ? <ExecutionCard execution={runExecution} title="Latest sample run" /> : null}
          {submitExecution ? <ExecutionCard execution={submitExecution} title="Latest submission" /> : null}

          {recentRuns.length ? (
            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <h3>Recent runs</h3>
              {recentRuns.map((execution) => (
                <ExecutionCard key={execution.id} execution={execution} title={new Date(execution.createdAt).toLocaleString()} compact />
              ))}
            </section>
          ) : null}

          {recentSubmissions.length ? (
            <section className="stack" style={{ borderTop: "1px solid rgba(13, 27, 71, 0.08)", paddingTop: 20 }}>
              <h3>Recent submissions</h3>
              {recentSubmissions.map((execution) => (
                <ExecutionCard key={execution.id} execution={execution} title={new Date(execution.createdAt).toLocaleString()} compact />
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

function ValidationBadge({ result }: { result?: ReferenceValidationTestResult }) {
  if (!result) {
    return null;
  }

  return (
    <span
      aria-label={result.passed ? "Passed" : "Failed"}
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

function renderHiddenTestValidation(testId: string, testResult?: ReferenceValidationTestResult) {
  if (!testResult || testResult.passed) {
    return null;
  }

  const detailBlocks = [
    { label: "Compiler output", value: testResult.compileOutput },
    { label: "Runtime error", value: testResult.stderr },
    { label: "Judge0 message", value: testResult.message },
    { label: "Program output", value: testResult.stdout }
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
        Validation failed{testResult.statusLabel ? `: ${testResult.statusLabel}` : ""}
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
          The reference solution did not pass this hidden test.
        </p>
      )}
    </section>
  );
}

function ExecutionCard({ execution, title, compact = false }: { execution: CodingExecution; title: string; compact?: boolean }) {
  const testSummary = execution.resultSummary?.tests;
  const tests = Array.isArray(testSummary) ? testSummary : [];
  return (
    <section className="stack" style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>{title}</strong>
        <span className="muted">
          {execution.status} {execution.judge0StatusLabel ? `· ${execution.judge0StatusLabel}` : ""}
        </span>
      </div>
      {execution.stdout ? (
        <div className="field">
          <label>Stdout</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stdout}</pre>
        </div>
      ) : null}
      {execution.stderr ? (
        <div className="field">
          <label>Stderr</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.stderr}</pre>
        </div>
      ) : null}
      {execution.compileOutput ? (
        <div className="field">
          <label>Compile output</label>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{execution.compileOutput}</pre>
        </div>
      ) : null}
      {execution.message ? <p className="muted">{execution.message}</p> : null}
      {tests.length && !compact ? (
        <div className="stack">
          <strong>Hidden test results</strong>
          {tests.map((test) => {
            const item = test as Record<string, unknown>;
            return (
              <div key={String(item.id ?? item.name)} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <span>{String(item.name ?? item.id ?? "Test")}</span>
                <span className="muted">
                  {item.passed ? "passed" : "failed"} {item.statusLabel ? `· ${String(item.statusLabel)}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
