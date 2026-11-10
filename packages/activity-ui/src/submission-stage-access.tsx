"use client";
import { ActionIcon } from "./action-icon";
const messages = {
  en: { required: "Safe Exam Browser is required for this stage.", open: "Open in Safe Exam Browser" },
  fr: { required: "Safe Exam Browser est requis pour cette étape.", open: "Ouvrir dans Safe Exam Browser" },
  zh: { required: "此阶段需要使用 Safe Exam Browser。", open: "在 Safe Exam Browser 中打开" },
  ar: { required: "يلزم استخدام Safe Exam Browser لهذه المرحلة.", open: "فتح في Safe Exam Browser" }
};
/** The host owns launch/proof; plugins display this only after a guarded stage request. */
export function SubmissionStageAccessGate({ locale = "en", onRequestAccess }: { locale?: string; onRequestAccess?: () => void }) {
  const copy = messages[locale as keyof typeof messages] ?? messages.en;
  return <div className="preview-panel stack"><p role="status">{copy.required}</p><div><button type="button" disabled={!onRequestAccess} onClick={onRequestAccess}><ActionIcon name="open" />{copy.open}</button></div></div>;
}
export function isSubmissionStageAccessError(reason: unknown) {
  return Boolean(reason && typeof reason === "object" && "code" in reason && reason.code === "SAFE_EXAM_BROWSER_REQUIRED");
}
