"use client";
import { HelpLabel, HelpTooltip } from "@cognelo/activity-ui";

import { createContext, useContext } from "react";
import { ToggleSwitch, fromZonedDateTimeInput, toZonedDateTimeInput } from "@cognelo/activity-ui";
import { defaultSubmissionStagePolicy, submissionStageWindow, type SubmissionStagePolicies, type SubmissionStagePolicy } from "@cognelo/contracts";
import type { SubmissionStageDefinition } from "@cognelo/activity-sdk";
import { DateTimeMinuteInput } from "./date-time-minute-input";

const en = { seb: "Require Safe Exam Browser", sebHelp: "Students must use this activity’s Safe Exam Browser configuration for this stage. Assignment resources remain accessible outside SEB.", title: "Submission stages", activate: "Activate stage", activation: "activation", activationHelp: "Activation permits new stage actions. Students may prepare draft files before file hand-in is activated. Answering attempts already started may finish with their existing timing.", deadline: "deadline", limit: "time limit", override: "Override", timed: "Set a time limit", minutes: "Minutes", allowLate: "Allow late submissions", latePolicy: "late-submission policy", limited: "Limit the late-submission period", days: "Days", hours: "Hours", noDeadline: "No deadline", inherited: "Uses activity cutoff", effective: "Effective deadline", start: "The time limit starts when this stage begins. It does not include waiting between stages.", optional: "Leave blank to use the activity cutoff, if one is set.", hard: "Available until is a hard cutoff for every stage, including late submissions.", accepts: "Submissions close", inactive: "This stage is disabled in the activity. Its settings are retained." };
const fr: typeof en = { seb: "Exiger Safe Exam Browser", sebHelp: "Les étudiants doivent utiliser la configuration Safe Exam Browser de cette activité pour cette étape. Les documents du devoir restent accessibles hors de SEB.", title: "Étapes de remise", activate: "Activer l’étape", activation: "activation", activationHelp: "L’activation autorise les nouvelles actions de cette étape. Les étudiants peuvent préparer leurs fichiers avant l’activation de la remise. Les tentatives de réponse commencées peuvent se terminer avec leur durée existante.", deadline: "date limite", limit: "limite de temps", override: "Remplacer", timed: "Fixer une limite de temps", minutes: "Minutes", allowLate: "Autoriser les remises en retard", latePolicy: "politique de retard", limited: "Limiter la période de remise en retard", days: "Jours", hours: "Heures", noDeadline: "Aucune date limite", inherited: "Utilise la fermeture de l’activité", effective: "Date limite effective", start: "La limite de temps commence au début de cette étape. L’attente entre les étapes ne compte pas.", optional: "Laissez vide pour utiliser la fermeture de l’activité, si elle est définie.", hard: "Disponible jusqu’au est une fermeture définitive pour toutes les étapes, y compris les remises en retard.", accepts: "Fin des remises", inactive: "Cette étape est désactivée dans l’activité. Ses paramètres sont conservés." };
const zh: typeof en = { seb: "要求使用 Safe Exam Browser", sebHelp: "此阶段须使用本活动的 Safe Exam Browser 配置。作业资料仍可在普通浏览器中访问。", title: "提交阶段", activate: "开放阶段", activation: "开放状态", activationHelp: "开放后可开始本阶段。文件提交开放前仍可准备草稿。已开始的答题可按现有计时完成。", deadline: "截止时间", limit: "时间限制", override: "覆盖", timed: "设置时间限制", minutes: "分钟", allowLate: "允许迟交", latePolicy: "迟交规则", limited: "限制迟交期限", days: "天", hours: "小时", noDeadline: "无截止时间", inherited: "使用活动关闭时间", effective: "实际截止时间", start: "计时从本阶段开始，不包括阶段之间的等待。", optional: "留空则使用活动关闭时间（如已设置）。", hard: "活动关闭时间限制所有阶段，包括迟交。", accepts: "提交关闭时间", inactive: "此阶段已关闭，设置仍保留。" };
const ar: typeof en = { seb: "اشتراط Safe Exam Browser", sebHelp: "يجب استخدام إعداد Safe Exam Browser الخاص بهذا النشاط في هذه المرحلة. تبقى ملفات الواجب متاحة خارجه.", title: "مراحل التسليم", activate: "تفعيل المرحلة", activation: "التفعيل", activationHelp: "يسمح التفعيل ببدء إجراءات المرحلة. يمكن تجهيز الملفات قبل تفعيل التسليم، وتُكمل محاولات الإجابة التي بدأت وفق توقيتها الحالي.", deadline: "الموعد النهائي", limit: "الحد الزمني", override: "تجاوز", timed: "تحديد مدة زمنية", minutes: "دقائق", allowLate: "السماح بالتسليم المتأخر", latePolicy: "سياسة التأخير", limited: "تحديد فترة التأخير", days: "أيام", hours: "ساعات", noDeadline: "لا موعد نهائي", inherited: "يستخدم إغلاق النشاط", effective: "الموعد النهائي الفعلي", start: "تبدأ المدة عند بدء المرحلة ولا تشمل الانتظار بين المراحل.", optional: "اتركه فارغاً لاستخدام إغلاق النشاط إن وُجد.", hard: "إغلاق النشاط حد نهائي لكل المراحل بما فيها التسليم المتأخر.", accepts: "إغلاق التسليم", inactive: "هذه المرحلة معطلة وتُحفظ إعداداتها." };
export type StageScheduleDefinition = SubmissionStageDefinition & { active?: boolean };
export const StageScheduleContext = createContext<{ stages: StageScheduleDefinition[]; summative?: boolean; supportsSafeExamBrowser?: boolean; general: SubmissionStagePolicies; timeZone: string; locale: string }>({ stages: [], general: {}, timeZone: "UTC", locale: "en" });
export const useStageSchedule = () => useContext(StageScheduleContext);
export function stagePoliciesForDraft(value: SubmissionStagePolicies | undefined, timeZone: string): SubmissionStagePolicies {
  return Object.fromEntries(Object.entries(value ?? {}).map(([id, policy]) => [id, { ...policy, ...(policy.deadline !== undefined ? { deadline: policy.deadline ? toZonedDateTimeInput(policy.deadline, timeZone) : null } : {}) }]));
}
export function stagePoliciesForSave(value: SubmissionStagePolicies, timeZone: string): SubmissionStagePolicies {
  return Object.fromEntries(Object.entries(value).map(([id, policy]) => [id, { ...policy, ...(policy.deadline !== undefined ? { deadline: policy.deadline ? fromZonedDateTimeInput(policy.deadline, timeZone) : null } : {}) }]));
}
export function ActivityStageSchedule({ value, onChange, availableUntil, disabled, inherited, legacyTimeLimit }: {
  value: SubmissionStagePolicies; onChange: (value: SubmissionStagePolicies) => void; availableUntil: string; disabled: boolean; inherited?: SubmissionStagePolicies; legacyTimeLimit?: number | null;
}) {
  const { stages, locale, timeZone, summative, supportsSafeExamBrowser } = useStageSchedule(), copy = ({ en, fr, zh, ar } as Record<string, typeof en>)[locale] ?? en;
  if (!stages.length) return null;
  const update = (id: string, patch: Partial<SubmissionStagePolicy>) => onChange({ ...value, [id]: { ...value[id], ...patch } });
  function override(id: string, keys: Array<keyof SubmissionStagePolicy>, checked: boolean, effective: SubmissionStagePolicy) {
    const next = { ...value[id] };
    for (const key of keys) { if (checked) Object.assign(next, { [key]: effective[key] }); else delete next[key]; }
    onChange({ ...value, [id]: next });
  }
  return <section className="stack activity-stage-schedule"><HelpLabel help={copy.hard}><h3>{copy.title}</h3></HelpLabel>
    {stages.map(stage => {
      const name = stage.names[locale as keyof typeof stage.names] ?? stage.names.en, own = value[stage.id] ?? {};
      const policy = { ...defaultSubmissionStagePolicy, ...(stage.assessment ? { timeLimitMinutes: legacyTimeLimit ?? null } : {}), ...inherited?.[stage.id], ...own };
      const dateLabel = `${name} — ${copy.deadline}`, limitLabel = `${name} — ${copy.limit}`;
      let window: ReturnType<typeof submissionStageWindow> | null = null;
      try { const saved = stagePoliciesForSave({ [stage.id]: policy }, timeZone)[stage.id] as SubmissionStagePolicy; window = submissionStageWindow(saved, availableUntil ? fromZonedDateTimeInput(availableUntil, timeZone) : null); } catch { /* Keep invalid input in the draft for ordinary form validation. */ }
      const duration = policy.lateLimitMinutes ?? 1440;
      const enabled = (key: keyof SubmissionStagePolicy) => !inherited || own[key] !== undefined;
      const group = (label: string, keys: Array<keyof SubmissionStagePolicy>) => inherited && <label className="checkbox-row"><input type="checkbox" checked={keys.some(key => own[key] !== undefined)} disabled={disabled || stage.active === false} onChange={event => override(stage.id, keys, event.currentTarget.checked, policy)} />{copy.override} {label}</label>;
      return <fieldset aria-label={name} className="stack preview-panel" key={stage.id} disabled={disabled || stage.active === false}><legend><strong>{name}</strong>{stage.active === false && <HelpTooltip content={copy.inactive} label={name} />}</legend>
        {group(`${name} — ${copy.activation}`, ["enabled"])}
        <ToggleSwitch locale={locale} help={copy.activationHelp} label={<><span className="sr-only">{name} — </span>{copy.activate}</>} checked={policy.enabled !== false} disabled={!enabled("enabled")} onChange={enabled => update(stage.id, { enabled })} />
        {summative && supportsSafeExamBrowser !== false && stage.supportsSafeExamBrowser !== false && <>
          {group(`${name} — ${copy.seb}`, ["requireSafeExamBrowser"])}
          <ToggleSwitch locale={locale} help={copy.sebHelp} label={<><span className="sr-only">{name} — </span>{copy.seb}</>} checked={policy.requireSafeExamBrowser === true} disabled={!enabled("requireSafeExamBrowser")} onChange={requireSafeExamBrowser => update(stage.id, { requireSafeExamBrowser })} />
        </>}
        {group(dateLabel, ["deadline"])}
        <div className="field"><HelpLabel help={copy.optional}><label htmlFor={`stage-${stage.id}-${inherited ? "override" : "general"}-deadline`}>{dateLabel}</label></HelpLabel>
          <DateTimeMinuteInput id={`stage-${stage.id}-${inherited ? "override" : "general"}-deadline`} value={policy.deadline ?? ""} disabled={!enabled("deadline")} onChange={deadline => update(stage.id, { deadline: deadline || null })} />
        </div>
        <p role="status">{window?.deadline ? `${policy.deadline ? copy.effective : copy.inherited}: ${new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(window.deadline))}` : copy.noDeadline}</p>
        {group(limitLabel, ["timeLimitMinutes"])}
        <ToggleSwitch locale={locale} help={copy.start} label={<><span className="sr-only">{name} — </span>{copy.timed}</>} checked={policy.timeLimitMinutes !== null} disabled={!enabled("timeLimitMinutes")} onChange={checked => update(stage.id, { timeLimitMinutes: checked ? 60 : null })} />
        {policy.timeLimitMinutes !== null && <label className="field">{limitLabel} ({copy.minutes})<input type="number" min={1} max={1440} value={policy.timeLimitMinutes} disabled={!enabled("timeLimitMinutes")} onChange={event => update(stage.id, { timeLimitMinutes: Number(event.currentTarget.value) })} /></label>}
        {stage.allowsLateSubmissions && <>
          {group(`${name} — ${copy.latePolicy}`, ["allowLate", "lateLimitMinutes"])}
          <ToggleSwitch locale={locale} label={<><span className="sr-only">{name} — </span>{copy.allowLate}</>} checked={policy.allowLate} disabled={!enabled("allowLate")} onChange={allowLate => update(stage.id, { allowLate, ...(!allowLate ? { lateLimitMinutes: null } : {}) })} />
          {policy.allowLate && <>
            <ToggleSwitch locale={locale} label={<><span className="sr-only">{name} — </span>{copy.limited}</>} checked={policy.lateLimitMinutes !== null} disabled={!enabled("allowLate")} onChange={limited => update(stage.id, { lateLimitMinutes: limited ? 1440 : null })} />
            {policy.lateLimitMinutes !== null && <div className="activity-stage-duration">{([[copy.days, 1440, 3650], [copy.hours, 60, 23], [copy.minutes, 1, 59]] as const).map(([label, unit, max]) => <label className="field" key={unit}>{label}<input aria-label={`${name} — ${label}`} type="number" min={0} max={max} disabled={!enabled("allowLate")} value={unit === 1440 ? Math.floor(duration / unit) : Math.floor(duration % (unit === 60 ? 1440 : 60) / unit)} onChange={event => { const prior = unit === 1440 ? Math.floor(duration / unit) : Math.floor(duration % (unit === 60 ? 1440 : 60) / unit); update(stage.id, { lateLimitMinutes: duration + (Number(event.currentTarget.value) - prior) * unit }); }} /></label>)}</div>}
          </>}
        </>}
        {window?.closesAt && <p className="muted">{copy.accepts}: {new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(window.closesAt))}</p>}
      </fieldset>;
    })}
  </section>;
}
