"use client";

import { HelpLabel, ToggleSwitch } from "@cognelo/activity-ui";
import { getCodingExerciseCpuTimeLimit, getCodingExerciseMaxTestRuns, type CodingExerciseConfig, type CodingExercisePrivateConfig } from "../coding-exercises";
import { formatCodingExercisesMessage, type CodingExercisesLocale } from "./messages";

type FeedbackConfig = CodingExercisePrivateConfig["aiFeedback"];

export function CodingExerciseGradingGeneral({ config, feedback, onConfigChange, onFeedbackChange, validationMessages, locale }: {
  config: CodingExerciseConfig; feedback: FeedbackConfig; locale: CodingExercisesLocale;
  onConfigChange: (value: Partial<CodingExerciseConfig>) => void; onFeedbackChange: (value: FeedbackConfig) => void;
  validationMessages: string[];
}) {
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1]) => formatCodingExercisesMessage(locale, key);
  const tests = feedback.testsEnabled !== false;
  const rubric = feedback.gradingEnabled;
  const limit = getCodingExerciseMaxTestRuns({ ...config, testsEnabled: true });
  const withCriterion = (value: FeedbackConfig): FeedbackConfig => value.criteria.length ? value : { ...value, criteria: [{
    id: "correctness", title: t("defaultCriterionTitle"), description: t("defaultCriterionDescription"), weightPercent: 100
  }] };
  return <div className="stack">
    <ToggleSwitch label={t("enableRubricGrading")} locale={locale} checked={rubric} onChange={enabled => {
      const value = { ...feedback, gradingEnabled: enabled,
        testWeightPercent: enabled ? tests ? 60 : 0 : tests ? 100 : 0,
        aiWeightPercent: enabled ? tests ? 40 : 100 : 0 };
      onFeedbackChange(enabled ? withCriterion(value) : value);
    }} />
    {rubric ? <div className="field">
      <label htmlFor="coding-ai-rubric-weight">{t("aiWeightPercent")}</label>
      <input id="coding-ai-rubric-weight" type="number" min={1} max={100} readOnly={!tests}
        value={tests ? feedback.aiWeightPercent : 100} onChange={event => {
          const value = Math.min(100, Math.max(0, Number(event.target.value)));
          onFeedbackChange({ ...feedback, aiWeightPercent: value, testWeightPercent: 100 - value });
        }} />
    </div> : null}
    <ToggleSwitch label={t("enableTests")} locale={locale} checked={tests} onChange={enabled => {
      onFeedbackChange({ ...feedback, testsEnabled: enabled,
        testWeightPercent: enabled ? rubric ? 60 : 100 : 0, aiWeightPercent: rubric ? enabled ? 40 : 100 : 0 });
      onConfigChange({ testsEnabled: enabled });
    }} />
    {tests ? <div className="field">
      <label htmlFor="coding-ai-test-weight">{t("testWeightPercent")}</label>
      <input id="coding-ai-test-weight" type="number" min={0} max={100} readOnly={!rubric}
        value={rubric ? feedback.testWeightPercent : 100} onChange={event => {
          const value = Math.min(100, Math.max(0, Number(event.target.value)));
          onFeedbackChange({ ...feedback, testWeightPercent: value, aiWeightPercent: 100 - value });
        }} />
    </div> : null}
    <section className="stack">
      <HelpLabel help={t("practiceRunsHelp")}><h3>{t("practiceRunsTitle")}</h3></HelpLabel>
      <div className="field">
        <label htmlFor="coding-test-run-limit-mode">{t("practiceRunLimitMode")}</label>
        <select id="coding-test-run-limit-mode" disabled={!tests} value={limit === null ? "unlimited" : "limited"}
          onChange={event => onConfigChange({ maxTestRuns: event.target.value === "unlimited" ? null : config.responseMode === "blanks" ? 0 : 3 })}>
          <option value="unlimited">{t("unlimitedTestRuns")}</option>
          <option value="limited">{t("limitedTestRuns")}</option>
        </select>
      </div>
      {limit !== null ? <div className="field">
        <label htmlFor="coding-max-test-runs">{t("maxTestRuns")}</label>
        <input id="coding-max-test-runs" type="number" min={0} max={100000} disabled={!tests} value={limit}
          onChange={event => onConfigChange({ maxTestRuns: Number(event.target.value) })} />
      </div> : null}
    </section>
    <div className="field">
      <HelpLabel help={t("editorTimeLimitHelp")}><label htmlFor="coding-max-editor-seconds">{t("editorTimeLimit")}</label></HelpLabel>
      <input id="coding-max-editor-seconds" type="number" min={1} max={5} disabled={!tests}
        value={getCodingExerciseCpuTimeLimit(config.maxEditorSeconds)}
        onChange={event => onConfigChange({ maxEditorSeconds: Number(event.target.value || "1") * 60 })} />
    </div>
    <section className="stack">
      <HelpLabel help={t("aiFeedbackHelp")}><h3>{t("aiFeedbackTitle")}</h3></HelpLabel>
      <ToggleSwitch label={t("aiFeedbackEnabled")} checked={feedback.enabled} locale={locale} onChange={enabled => {
        const value = { ...feedback, enabled };
        onFeedbackChange(enabled ? withCriterion(value) : value);
      }} />
      {feedback.enabled ? <div className="field">
        <label htmlFor="coding-ai-instructions">{t("feedbackInstructions")}</label>
        <textarea id="coding-ai-instructions" maxLength={8000} required rows={5} value={feedback.instructions}
          onChange={event => onFeedbackChange({ ...feedback, instructions: event.target.value })} />
      </div> : null}
    </section>
    {validationMessages.length ? <div className="error" role="alert"><ul>{validationMessages.map(message => <li key={message}>{message}</li>)}</ul></div> : null}
  </div>;
}
