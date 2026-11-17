"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionIcon, ConfirmationDialog, HelpLabel, ProgressDialog, SideNavigation, ToggleSwitch, useActivityKnowledgeGeneration, useNotifications } from "@cognelo/activity-ui";
import { homeworkGradingSchema, type HomeworkGradingPolicy, type HomeworkCriterion } from "../rubric";
import { homeworkRubricCopy } from "./rubric-copy";
import type { HomeworkRequest } from "./workflow-types";

export function HomeworkRubricEditor({ policy, onChange, questionsEnabled, locale, request, title, prompt, guidance, onGuidanceSaved, disabled }: {
  policy: HomeworkGradingPolicy; onChange: (value: HomeworkGradingPolicy) => void; questionsEnabled: boolean; locale: "en" | "fr" | "zh" | "ar";
  request?: HomeworkRequest; title: string; prompt: string; guidance: Record<string, unknown>; onGuidanceSaved: (kind: "code" | "questions", guidance: string) => void; disabled: boolean;
}) {
  const copy = homeworkRubricCopy(locale), notifications = useNotifications(), id = useId();
  const knowledge = useActivityKnowledgeGeneration();
  const [tab, setTab] = useState("rubric"), [dialog, setDialog] = useState<"code" | "questions" | null>(null), [guidanceDraft, setGuidanceDraft] = useState("");
  const [busy, setBusy] = useState(false), controller = useRef<AbortController | null>(null), sequence = useRef(0);
  const guidanceQueue = useRef<Promise<unknown>>(Promise.resolve()), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  const currentPolicy = useRef(policy); currentPolicy.current = policy;
  function redistribute(criteria: HomeworkCriterion[]) { return criteria.map((item, index) => ({ ...item, weightPercent: Math.floor(100 / criteria.length) + (index < 100 % criteria.length ? 1 : 0) })); }
  async function generate() {
    if (!request || !dialog) return;
    const kind = dialog, guidanceValue = guidanceDraft.trim(), token = ++sequence.current;
    const pending = new AbortController(); controller.current = pending;
    setDialog(null); setBusy(true);
    try {
      // Confirmed guidance writes remain ordered before a retry; cancellation only aborts model work.
      const saveGuidance = guidanceQueue.current.then(() => request<{ guidance: string }>("rubric-guidance", { method: "PUT", body: JSON.stringify({ kind, guidance: guidanceValue }) }));
      guidanceQueue.current = saveGuidance.catch(() => undefined);
      const saved = await saveGuidance;
      if (mounted.current) onGuidanceSaved(kind, saved.guidance);
      if (!mounted.current || token !== sequence.current) return;
      const generated = await request<{ criteria: HomeworkCriterion[] }>("generate-rubric", { method: "POST", signal: pending.signal, body: JSON.stringify({ kind, guidance: guidanceValue, title, prompt, knowledge: knowledge.request }) });
      if (token === sequence.current && !pending.signal.aborted) onChange({ ...currentPolicy.current, [kind]: { ...currentPolicy.current[kind], criteria: generated.criteria } });
    } catch (error) { if (mounted.current && !pending.signal.aborted && token === sequence.current) notifications.error(error instanceof Error ? error.message : copy.error); }
    finally { if (mounted.current && token === sequence.current) setBusy(false); }
  }
  const valid = homeworkGradingSchema.safeParse(policy).success && (!policy.enabled || questionsEnabled || policy.questionsWeightPercent === 0);
  return <>
    <div className="settings-layout">
      <SideNavigation ariaLabel={copy.grading} items={[{ id: "rubric", label: copy.rubric, isActive: tab === "rubric" }, { id: "tests", label: copy.tests, isActive: tab === "tests" }]}
        tabs={{ idPrefix: id, panelId: `${id}-panel`, onSelect: setTab }} />
      <section id={`${id}-panel`} role="tabpanel" className="settings-content stack">
        {tab === "tests" ? <p>{copy.later}</p> : <>
          <ToggleSwitch locale={locale} label={copy.enabled} checked={policy.enabled} disabled={disabled} onChange={enabled => onChange({ ...policy, enabled })} />
          <p className="muted">{copy.generic}</p>
          <div className="settings-grid">
            {(["code", "questions"] as const).map(kind => <label className="field" key={kind}><span>{kind === "code" ? copy.codePoints : copy.questionPoints}</span>
              <input type="number" min={0} max={100} step={1} disabled={disabled || kind === "questions" && !questionsEnabled} value={policy[`${kind}WeightPercent`]} onChange={event => onChange({ ...policy, [`${kind}WeightPercent`]: Number(event.target.value) })} /></label>)}
            <label className="field"><span>{copy.testPoints}</span><input readOnly type="number" value={0} /></label>
          </div>
          <p>{copy.total}: {policy.codeWeightPercent + policy.questionsWeightPercent}</p>
          {!valid && <p role="alert" className="error">{copy.invalid}</p>}
          {(["code", "questions"] as const).map(kind => <section className="inline-panel stack" key={kind}>
            <h3>{kind === "code" ? copy.code : copy.questions}</h3>
            <div className="row wrap">
              <button type="button" disabled={disabled || policy[kind].criteria.length >= 20} onClick={() => onChange({ ...policy, [kind]: { ...policy[kind], criteria: redistribute([...policy[kind].criteria, { id: crypto.randomUUID(), title: copy.criterion, description: "", weightPercent: 1 }]) } })}><ActionIcon name="add" />{copy.add}</button>
              {request && <button type="button" disabled={disabled || busy || !title.trim()} onClick={() => { setGuidanceDraft(typeof guidance[kind] === "string" ? guidance[kind] as string : ""); setDialog(kind); }}><ActionIcon name="generate" />{copy.generate}</button>}
            </div>
            {policy[kind].criteria.map((criterion, index) => <section key={criterion.id} className="inline-panel stack stack-tight">
              <div className="row wrap"><strong>{copy.criterion} {index + 1}</strong><button type="button" aria-label={`${copy.remove} ${index + 1}`} disabled={disabled} onClick={() => onChange({ ...policy, [kind]: { ...policy[kind], criteria: redistribute(policy[kind].criteria.filter(item => item.id !== criterion.id)) } })}><ActionIcon name="remove" />{copy.remove}</button></div>
              {(["title", "description", "weightPercent"] as const).map(field => <label className="field" key={field}><span>{field === "title" ? copy.title : field === "description" ? copy.description : copy.weight}</span>
                {field === "description" ? <textarea maxLength={4000} rows={3} disabled={disabled} value={criterion.description} onChange={event => { const value = event.target.value; onChange({ ...policy, [kind]: { ...policy[kind], criteria: policy[kind].criteria.map(item => item.id === criterion.id ? { ...item, description: value } : item) } }); }} /> :
                  <input type={field === "weightPercent" ? "number" : "text"} min={1} max={100} maxLength={200} disabled={disabled} value={criterion[field]} onChange={event => { const value = field === "weightPercent" ? Number(event.target.value) : event.target.value; onChange({ ...policy, [kind]: { ...policy[kind], criteria: policy[kind].criteria.map(item => item.id === criterion.id ? { ...item, [field]: value } : item) } }); }} />}</label>)}
            </section>)}
            <div className="field"><HelpLabel help={copy.directionsHelp}><label htmlFor={`${id}-${kind}-directions`}>{copy.directions}</label></HelpLabel><textarea id={`${id}-${kind}-directions`} rows={5} maxLength={8000} disabled={disabled} value={policy[kind].instructions} onChange={event => { const value = event.target.value; onChange({ ...policy, [kind]: { ...policy[kind], instructions: value } }); }} /></div>
          </section>)}
        </>}
      </section>
    </div>
    {typeof document !== "undefined" && createPortal(<>
      <ConfirmationDialog open={dialog !== null} title={copy.generate} message={<div className="stack"><div className="field"><HelpLabel help={copy.guidanceHelp}><label htmlFor={`${id}-guidance`}>{copy.guidance}</label></HelpLabel><textarea id={`${id}-guidance`} autoFocus rows={5} maxLength={8000} value={guidanceDraft} onChange={event => setGuidanceDraft(event.target.value)} /></div>{dialog && policy[dialog].criteria.length > 0 && <p>{copy.replace}</p>}</div>} confirmLabel={copy.generate} cancelLabel={copy.cancel} confirmIcon="generate" onCancel={() => setDialog(null)} onConfirm={generate} />
      <ProgressDialog open={busy} title={copy.generate} progressLabel={copy.generate} cancelLabel={copy.cancel} onCancel={() => { controller.current?.abort(); sequence.current++; setBusy(false); }} />
    </>, document.body)}
  </>;
}
