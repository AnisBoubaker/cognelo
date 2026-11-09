"use client";
import { HelpLabel } from "@cognelo/activity-ui";

import { useEffect, useId, useRef, useState } from "react";
import { ActionIcon, ProgressDialog, SideNavigation, sideNavigationItemId, useDialogs } from "@cognelo/activity-ui";
import type { CodingHomeworkLocale } from "./messages";
import type { CodingHomeworkAuthoringSubmissionRequirements } from "./client";
import type { TeacherSolutionSelection } from "../teacher-solution-selection";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { body, homeworkFileBase64, type HomeworkRequest } from "./workflow-types";

type Solution = TeacherSolutionSelection & { revision: string; locked: boolean };
export function HomeworkSolutionSelector({ request, locale, requirements, onChange, onSolutionChanged }: {
  request: HomeworkRequest; locale: CodingHomeworkLocale; requirements: CodingHomeworkAuthoringSubmissionRequirements;
  onChange: (value: CodingHomeworkAuthoringSubmissionRequirements) => void;
  onSolutionChanged: (previous: TeacherSolutionSelection, next: TeacherSolutionSelection) => void;
}) {
  const copy = homeworkWorkflowCopy(locale), dialogs = useDialogs();
  const [solution, setSolution] = useState<Solution | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null), current = useRef(solution), onChanged = useRef(onSolutionChanged);
  current.current = solution; onChanged.current = onSolutionChanged;
  const [selectedPath, setSelectedPath] = useState<string | null>(null), navigationId = useId();
  const activePath = solution?.files.some(file => file.path === selectedPath) ? selectedPath! : solution?.files[0]?.path;
  const visibleFunctions = solution?.functions.filter(fn => fn.sourcePath === activePath) ?? [];
  const selected = new Set(requirements.requiredFunctions.map(fn => `${fn.filePath}:${fn.name}`));
  const disabled = busy || !solution || solution.locked;
  function apply(next: Solution) {
    if (current.current && current.current.revision !== next.revision) onChanged.current(current.current, next);
    current.current = next; setSolution(next);
    setSelectedPath(previous => next.files.some(file => file.path === previous) ? previous : next.files[0]?.path ?? null);
  }
  useEffect(() => {
    const pending = new AbortController(); setSolution(null); setSelectedPath(null); current.current = null;
    void request<Solution>("teacher-solution", { signal: pending.signal }).then(next => { if (!pending.signal.aborted) apply(next); })
      .catch(reason => { if (!pending.signal.aborted) setError(reason.message); });
    return () => { pending.abort(); controller.current?.abort(); };
  }, [request]);
  function select(keys: string[]) {
    const known = new Set(solution?.functions.map(fn => fn.key));
    const unrelated = requirements.requiredFunctions.filter(fn => !known.has(`${fn.filePath}:${fn.name}`));
    onChange({ ...requirements, requiredFunctions: [...unrelated, ...(solution?.functions.filter(fn => keys.includes(fn.key)).map(fn => ({ name: fn.functionName, filePath: fn.sourcePath, required: true, ...fn.signature })) ?? [])] });
  }
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const pending = new AbortController(); controller.current = pending; setBusy(true); setError("");
    try { await action(pending.signal); }
    catch (reason) { if (!pending.signal.aborted) setError(reason instanceof Error ? reason.message : copy.error); }
    finally { if (controller.current === pending) { setBusy(false); controller.current = null; } }
  }
  async function upload(files: File[], zip: boolean) {
    if (!files.length || !solution) return;
    if (zip && solution.files.length && !await dialogs.confirm({ title: copy.replaceSolution, message: copy.replaceSolutionDetail, confirmLabel: copy.replaceSolution })) return;
    await run(async signal => {
      for (const file of files) {
        signal.throwIfAborted();
        const next = await request<Solution>("teacher-solution", body("PUT", { fileName: file.name, base64: await homeworkFileBase64(file), expectedRevision: current.current?.revision }, signal));
        apply(next);
      }
    });
  }
  async function remove(input: { kind: "file"; path: string } | { kind: "function"; key: string } | { kind: "all" }) {
    if (!solution) return;
    if (input.kind === "all" && !await dialogs.confirm({ title: copy.clearSolution, message: copy.clearSolutionDetail, confirmLabel: copy.clearSolution, confirmVariant: "danger" })) return;
    await run(async signal => apply(await request<Solution>("teacher-solution", body("DELETE", { ...input, expectedRevision: current.current?.revision }, signal))));
  }
  return <section className="stack homework-solution-selector">
    <HelpLabel help={<><p>{copy.solutionHelp}</p><p>{copy.solutionFilesHelp}</p>{solution?.locked && <p>{copy.solutionLocked}</p>}</>}><h3>{copy.solution}</h3></HelpLabel>
    <div className="row wrap">
      <label className="button secondary" aria-disabled={disabled}><ActionIcon name="upload" /> {copy.upload}<input disabled={disabled} type="file" accept=".c,.h" multiple hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files, false); }} /></label>
      <label className="button secondary" aria-disabled={disabled}><ActionIcon name="upload" /> {copy.solutionZip}<input disabled={disabled} type="file" accept=".zip" hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files, true); }} /></label>
      <button type="button" className="secondary" disabled={disabled || !solution?.functions.length} onClick={() => void run(async signal => { const result = await request<{ selectedFunctionKeys: string[] }>("select-functions", body("POST", undefined, signal)); select(result.selectedFunctionKeys); })}><ActionIcon name="generate" /> {copy.selectAi}</button>
      <button type="button" className="secondary" disabled={disabled || !solution?.files.length} onClick={() => void remove({ kind: "all" })}><ActionIcon name="remove" /> {copy.clearSolution}</button>
      {error && <button type="button" className="secondary" disabled={busy} onClick={() => void run(async signal => apply(await request<Solution>("teacher-solution", { signal })))}><ActionIcon name="refresh" /> {copy.refresh}</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {solution?.files.length ? <>
      <div className="homework-solution-browser">
        <div className="stack"><h4>{copy.requiredFiles}</h4>
          <SideNavigation ariaLabel={copy.requiredFiles} items={solution.files.map(file => ({ id: file.path, label: file.path, isActive: activePath === file.path,
            selection: { label: file.path, checked: requirements.requiredFiles.some(item => item.path === file.path), disabled,
              onChange: checked => onChange({ ...requirements, requiredFiles: checked ? [...requirements.requiredFiles.filter(item => item.path !== file.path), { path: file.path }] : requirements.requiredFiles.filter(item => item.path !== file.path) }) },
            action: { label: `${copy.removeFile}: ${file.path}`, disabled, onClick: () => void remove({ kind: "file", path: file.path }) }
          }))} tabs={{ idPrefix: navigationId, panelId: `${navigationId}-signatures`, onSelect: setSelectedPath }} />
        </div>
        <div className="stack homework-solution-signatures" role="tabpanel" id={`${navigationId}-signatures`} aria-labelledby={activePath ? sideNavigationItemId(navigationId, activePath) : undefined}>
          <HelpLabel help={copy.solutionNoFunctions}><h4>{copy.requiredFunctions}</h4></HelpLabel>
          {visibleFunctions.length ? <ul className="homework-solution-list">{visibleFunctions.map(fn => <li className="homework-solution-row" key={fn.key}>
            <label className="homework-choice"><input type="checkbox" disabled={disabled} checked={selected.has(fn.key)} onChange={event => select(event.target.checked ? [...selected, fn.key] : [...selected].filter(key => key !== fn.key))} /><span className="homework-choice-text"><code>{fn.signature ? `${fn.signature.returnType} ${fn.functionName}(${fn.signature.parameterTypes.join(", ") || "void"})` : fn.functionName}</code><span className="sr-only">{fn.sourcePath}</span></span></label>
            <button type="button" className="secondary icon-button" disabled={disabled} aria-label={`${copy.removeFunction}: ${fn.key}`} title={`${copy.removeFunction}: ${fn.key}`} onClick={() => void remove({ kind: "function", key: fn.key })}><ActionIcon name="remove" /></button>
          </li>)}</ul> : <p className="muted">{copy.solutionNoDefinitions}</p>}
        </div>
      </div>
    </> : solution && <p className="muted">{copy.solutionEmpty}</p>}
    <ProgressDialog open={busy} title={copy.solution} progressLabel={copy.loading} cancelLabel={copy.cancel} onCancel={() => controller.current?.abort()} />
  </section>;
}
