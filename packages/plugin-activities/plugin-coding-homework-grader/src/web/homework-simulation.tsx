"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionIcon, AppDateTime, MarkdownRenderer, ProgressDialog, useActivityReferenceAuthoring, useDialogs, useNotifications } from "@cognelo/activity-ui";
import type { StudentQuestionContext } from "../question-context";
import type { CodingHomeworkLocale } from "./messages";
import type { CodingHomeworkPreflightResult } from "./client";
import type { HomeworkRequest } from "./workflow-types";
import { homeworkWorkflowCopy } from "./workflow-copy";
import { QuestionCodeContext } from "./question-code-context";
const en = { title: "Simulation", help: "Check a ZIP as a student would, then choose whether to simulate its submission. Questions use this ZIP, your saved instructions and the course references. No student attempt or grade is created.", submit: "Simulate submission", progress: "Simulating submission…", saveFirst: "Save activity and reference changes before running a simulation.", prepareFirst: "Prepare the selected reference materials first.", context: "Uploaded code in context", generated: "Generated", incomplete: "I want to simulate submission of incomplete work.", confirm: "Use the checked ZIP to simulate this hand-in? This does not submit work for a student.", fileOnly: "This work would be submitted for teacher grading. Challenge questions are disabled.", blocked: "Resolve the file requirements or safety issues before simulating submission.", empty: "Upload a ZIP above to check it. The private teacher solution is not used for simulation.", error: "The simulation could not be completed." };
const fr: typeof en = { title: "Simulation", help: "Vérifiez un ZIP comme le ferait un étudiant, puis choisissez de simuler sa remise. Les questions utilisent ce ZIP, vos consignes enregistrées et les références du cours. Aucune tentative ni note étudiante n’est créée.", submit: "Simuler la remise", progress: "Simulation de la remise…", saveFirst: "Enregistrez les modifications de l’activité et des références avant la simulation.", prepareFirst: "Préparez d’abord les documents de référence sélectionnés.", context: "Code téléversé en contexte", generated: "Généré le", incomplete: "Je souhaite simuler la remise d’un travail incomplet.", confirm: "Utiliser le ZIP vérifié pour simuler cette remise ? Aucun travail n’est remis au nom d’un étudiant.", fileOnly: "Ce travail serait remis pour évaluation par l’enseignant. Les questions de vérification sont désactivées.", blocked: "Corrigez les problèmes de fichiers ou de sécurité avant de simuler la remise.", empty: "Téléversez un ZIP ci-dessus pour le vérifier. La solution privée de l’enseignant n’est pas utilisée pour la simulation.", error: "La simulation n’a pas pu être terminée." };
const zh: typeof en = { title: "模拟", help: "像学生一样检查 ZIP，再决定是否模拟提交。问题使用此 ZIP、已保存的说明和课程参考资料，不会创建学生作答记录或成绩。", submit: "模拟提交", progress: "正在模拟提交…", saveFirst: "运行模拟前请保存活动和参考资料更改。", prepareFirst: "请先准备所选参考资料。", context: "上传代码上下文", generated: "生成时间", incomplete: "我希望模拟提交不完整的作业。", confirm: "使用已检查的 ZIP 模拟提交？这不会代表学生提交作业。", fileOnly: "此作业将提交给教师评分。挑战问题已关闭。", blocked: "模拟提交前请解决文件要求或安全问题。", empty: "请在上方上传 ZIP 进行检查。模拟不会使用教师私有解答。", error: "无法完成模拟。" };
const ar: typeof en = { title: "المحاكاة", help: "افحص ملف ZIP كما يفعل الطالب، ثم اختر محاكاة تسليمه. تستخدم الأسئلة هذا الملف وتعليماتك المحفوظة ومراجع المقرر. لا تُنشأ محاولات أو درجات للطلاب.", submit: "محاكاة التسليم", progress: "جارٍ محاكاة التسليم…", saveFirst: "احفظ تغييرات النشاط والمراجع قبل المحاكاة.", prepareFirst: "أعدّ المواد المرجعية المختارة أولاً.", context: "الكود المرفوع في السياق", generated: "تاريخ التوليد", incomplete: "أريد محاكاة تسليم عمل غير مكتمل.", confirm: "هل تريد محاكاة تسليم ملف ZIP المفحوص؟ لن يُسلّم عمل نيابة عن طالب.", fileOnly: "سيُسلّم هذا العمل لتقييم المعلم. أسئلة التحقق معطّلة.", blocked: "عالج متطلبات الملفات أو مشكلات السلامة قبل محاكاة التسليم.", empty: "ارفع ملف ZIP أعلاه لفحصه. لا يُستخدم حل المعلم الخاص في المحاكاة.", error: "تعذر إكمال المحاكاة." };
type Result = { questionGenerationEnabled: boolean; generatedAt: string; questions: Array<{ id: string; orderIndex: number; questionText: string; context: StudentQuestionContext }> };
const incompleteCodes = new Set(["missing_file", "missing_folder", "missing_function", "signature_mismatch", "parser_error"]);
export function HomeworkSimulation({ request, locale, hasUnsavedChanges, questionsEnabled, preflight, preflightResult }: {
  request: HomeworkRequest; locale: CodingHomeworkLocale; hasUnsavedChanges: boolean; questionsEnabled: boolean; preflight: ReactNode; preflightResult: CodingHomeworkPreflightResult | null;
}) {
  const copy = ({ en, fr, zh, ar })[locale], workflow = homeworkWorkflowCopy(locale), references = useActivityReferenceAuthoring(), notifications = useNotifications(), dialogs = useDialogs();
  const [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [acknowledged, setAcknowledged] = useState(false), controller = useRef<AbortController | null>(null), version = useRef(0);
  useEffect(() => () => { version.current++; controller.current?.abort(); }, []);
  useEffect(() => { setAcknowledged(false); setResult(null); }, [preflightResult?.preflight.id]);
  useEffect(() => { setResult(null); }, [questionsEnabled]);
  const dirty = hasUnsavedChanges || (questionsEnabled && references?.dirty);
  const missingReferences = Boolean(questionsEnabled && references && (!references.loaded || (!references.prepared && (references.selectedCount ?? 0) > 0)));
  const issues = preflightResult?.summary.issues ?? [], incomplete = issues.some(issue => incompleteCodes.has(issue.code));
  const blocked = issues.some(issue => issue.severity === "error" && !incompleteCodes.has(issue.code)) || !preflightResult?.summary.validFiles.length;
  async function generate() {
    if (controller.current || dirty || missingReferences || !preflightResult || blocked || (incomplete && !acknowledged)) return;
    if (!await dialogs.confirm({ title: copy.submit, message: copy.confirm, confirmLabel: copy.submit, cancelLabel: workflow.cancel })) return;
    const pending = new AbortController(), current = ++version.current; controller.current = pending; setBusy(true);
    try { const value = await request<Result>("simulation", { method: "POST", body: JSON.stringify({ preflightId: preflightResult.preflight.id, acknowledgeIncomplete: incomplete && acknowledged }), signal: pending.signal }); if (!pending.signal.aborted && version.current === current) setResult(value); }
    catch (error) { if (!pending.signal.aborted && version.current === current) notifications.error(error instanceof Error ? error.message : copy.error); }
    finally { if (controller.current === pending) { controller.current = null; setBusy(false); } }
  }
  return <div className="stack homework-simulation"><h2>{copy.title}</h2><p className="muted">{copy.help}</p>
    {preflight}
    {dirty && <p role="status">{copy.saveFirst}</p>}{missingReferences && <p role="status">{copy.prepareFirst}</p>}
    {!preflightResult && <p>{copy.empty}</p>}
    {preflightResult && blocked && <p role="status">{copy.blocked}</p>}
    {preflightResult && !blocked && <>
      {incomplete && <label className="homework-choice"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.currentTarget.checked)} />{copy.incomplete}</label>}
      {(!incomplete || acknowledged) && <div className="row wrap"><button type="button" disabled={Boolean(busy || dirty || missingReferences)} onClick={() => void generate()}><ActionIcon name="generate" />{copy.submit}</button></div>}
    </>}
    {result && <p className="muted">{copy.generated}: <AppDateTime value={result.generatedAt} locale={locale} /></p>}
    {result?.questionGenerationEnabled === false && <p role="status">{copy.fileOnly}</p>}
    {result && <div className="homework-challenge-list">{result.questions.map((question, index) => <section className="homework-challenge-question" key={question.id} aria-labelledby={`simulation-${question.id}`}>
      <header className="homework-challenge-heading"><h4 id={`simulation-${question.id}`}>{workflow.questionNumber.replace("{number}", String(index + 1)).replace("{total}", String(result.questions.length))}</h4><MarkdownRenderer markdown={question.questionText} /></header>
      <div className="homework-challenge-body"><QuestionCodeContext context={question.context} locale={locale} label={copy.context} /></div>
    </section>)}</div>}
    {busy && createPortal(<ProgressDialog open title={copy.progress} progressLabel={copy.progress} cancelLabel={workflow.cancel} onCancel={() => controller.current?.abort()} />, document.body)}
  </div>;
}
