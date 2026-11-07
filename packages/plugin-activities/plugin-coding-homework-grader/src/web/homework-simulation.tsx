"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { ActionIcon, AppDateTime, MarkdownRenderer, ProgressDialog, useActivityReferenceAuthoring, useNotifications } from "@cognelo/activity-ui";
import type { StudentQuestionContext } from "../question-context";
import type { CodingHomeworkLocale } from "./messages";
import type { HomeworkRequest } from "./workflow-types";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { QuestionCodeContext } from "./question-code-context";
const en = { title: "Simulation", help: "Generate sample challenge questions from your saved private teacher solution, using the activity's saved instructions and prepared references. No student submission, attempt or grade is created.", generate: "Generate simulation questions", progress: "Generating simulation questions…", saveFirst: "Save activity and reference changes before running a simulation.", prepareFirst: "Prepare the selected reference materials first.", solution: "Teacher solution in context", generated: "Generated", empty: "The generated questions will appear here. Upload a private teacher solution in Activity before starting.", error: "The simulation could not be completed." };
const fr: typeof en = { title: "Simulation", help: "Générez des exemples de questions à partir de votre solution privée enregistrée, avec les consignes et références préparées de l’activité. Aucune remise, tentative ou note étudiante n’est créée.", generate: "Générer les questions de simulation", progress: "Génération des questions de simulation…", saveFirst: "Enregistrez les modifications de l’activité et des références avant la simulation.", prepareFirst: "Préparez d’abord les documents de référence sélectionnés.", solution: "Solution de l’enseignant en contexte", generated: "Généré le", empty: "Les questions générées apparaîtront ici. Téléversez d’abord une solution privée dans Activité.", error: "La simulation n’a pas pu être terminée." };
const zh: typeof en = { title: "模拟", help: "根据已保存的教师私有解答、活动说明和已准备参考资料生成示例挑战问题。不会创建学生提交、作答记录或成绩。", generate: "生成模拟问题", progress: "正在生成模拟问题…", saveFirst: "运行模拟前请保存活动和参考资料更改。", prepareFirst: "请先准备所选参考资料。", solution: "教师解答上下文", generated: "生成时间", empty: "生成的问题将显示在这里。开始前请在活动中上传教师私有解答。", error: "无法完成模拟。" };
const ar: typeof en = { title: "المحاكاة", help: "ولّد أسئلة تجريبية من حل المعلم الخاص المحفوظ، باستخدام تعليمات النشاط ومراجعه المُعدة. لا تُنشأ أي تسليمات أو محاولات أو درجات للطلاب.", generate: "توليد أسئلة المحاكاة", progress: "جارٍ توليد أسئلة المحاكاة…", saveFirst: "احفظ تغييرات النشاط والمراجع قبل المحاكاة.", prepareFirst: "أعدّ المواد المرجعية المختارة أولاً.", solution: "حل المعلم في السياق", generated: "تاريخ التوليد", empty: "ستظهر الأسئلة المُولدة هنا. ارفع حلاً خاصاً للمعلم في تبويب النشاط قبل البدء.", error: "تعذر إكمال المحاكاة." };
type Result = { generatedAt: string; questionLanguage: string; questions: Array<{ id: string; orderIndex: number; questionText: string; context: StudentQuestionContext }> };
export function HomeworkSimulation({ request, locale, hasUnsavedChanges }: { request: HomeworkRequest; locale: CodingHomeworkLocale; hasUnsavedChanges: boolean }) {
  const copy = ({ en, fr, zh, ar })[locale], workflow = homeworkWorkflowCopy(locale), references = useActivityReferenceAuthoring(), notifications = useNotifications();
  const [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), controller = useRef<AbortController | null>(null), version = useRef(0);
  useEffect(() => () => { version.current++; controller.current?.abort(); }, []);
  const dirty = hasUnsavedChanges || references?.dirty;
  const missingReferences = Boolean(references && (!references.loaded || (!references.prepared && (references.selectedCount ?? 0) > 0)));
  async function generate() {
    if (controller.current || dirty || missingReferences) return;
    const pending = new AbortController(), current = ++version.current; controller.current = pending; setBusy(true);
    try { const value = await request<Result>("simulation", { method: "POST", body: "{}", signal: pending.signal }); if (!pending.signal.aborted && version.current === current) setResult(value); }
    catch (error) { if (!pending.signal.aborted && version.current === current) notifications.error(error instanceof Error ? error.message : copy.error); }
    finally { if (controller.current === pending) { controller.current = null; setBusy(false); } }
  }
  return <section className="section stack homework-simulation"><h3>{copy.title}</h3><p className="muted">{copy.help}</p>
    {dirty && <p role="status">{copy.saveFirst}</p>}{missingReferences && <p role="status">{copy.prepareFirst}</p>}
    <div className="row wrap"><button type="button" disabled={Boolean(busy || dirty || missingReferences)} onClick={() => void generate()}><ActionIcon name="generate" />{copy.generate}</button>
      {result && <span className="muted">{copy.generated}: <AppDateTime value={result.generatedAt} locale={locale} /></span>}</div>
    {!result && <p>{copy.empty}</p>}
    {result && <div className="homework-challenge-list">{result.questions.map((question, index) => <section className="homework-challenge-question" key={question.id} aria-labelledby={`simulation-${question.id}`}>
      <header className="homework-challenge-heading"><h4 id={`simulation-${question.id}`}>{workflow.questionNumber.replace("{number}", String(index + 1)).replace("{total}", String(result.questions.length))}</h4><MarkdownRenderer markdown={question.questionText} /></header>
      <div className="homework-challenge-body"><QuestionCodeContext context={question.context} locale={locale} label={copy.solution} /></div>
    </section>)}</div>}
    {busy && createPortal(<ProgressDialog open title={copy.progress} progressLabel={copy.progress} cancelLabel={workflow.cancel} onCancel={() => controller.current?.abort()} />, document.body)}
  </section>;
}
