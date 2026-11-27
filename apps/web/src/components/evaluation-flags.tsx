"use client";
import type { EvaluationFlag } from "@cognelo/contracts";
import { HelpTooltip } from "@cognelo/activity-ui";

const titles = { en: "Possible unauthorized assistance", fr: "Aide non autorisée possible", zh: "可能存在未经许可的帮助", ar: "مساعدة غير مصرح بها محتملة" };
const explanations = { en: "This is a signal for teacher review, not a finding of misconduct.", fr: "Ce signal demande une vérification par le personnel; il ne constitue pas un constat d’inconduite.", zh: "这是供教师复核的提示，并非对学术不端的认定。", ar: "هذه إشارة لمراجعة المعلم وليست إثباتًا لسوء السلوك." };

/** Core-owned display shared by every flag-capable activity, including ungraded rows. */
export function EvaluationFlags({ flags = [], locale = "en" }: { flags?: EvaluationFlag[]; locale?: string }) {
  const language = locale in titles ? locale as keyof typeof titles : "en";
  return <>{flags.map(flag => <span key={`${flag.kind}:${flag.reasonCode}`} className="evaluation-flag">
    <HelpTooltip locale={locale} icon="alert" accessibleLabel={titles[language]} content={<div className="stack stack-tight">
      <strong>{titles[language]}</strong><span>{flag.messages[language] ?? flag.messages.en}</span><span>{explanations[language]}</span>
    </div>} />
  </span>)}</>;
}
