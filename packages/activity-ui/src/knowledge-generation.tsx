"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ActivityKnowledgeGenerationMode = "selected" | "suggest" | "ignore";
export type ActivityKnowledgeGenerationConcept = { id: string; title: string; skills: string[]; skillIds: string[]; misconceptions: string[]; misconceptionIds: string[] };
export type ActivityKnowledgeGenerationRequest =
  | { mode: "selected"; concepts: ActivityKnowledgeGenerationConcept[]; selectedConcepts: ActivityKnowledgeGenerationConcept[] }
  | { mode: "suggest"; concepts: ActivityKnowledgeGenerationConcept[] }
  | { mode: "ignore"; concepts: ActivityKnowledgeGenerationConcept[] };
export type GeneratedKnowledgeSelection = { conceptId: string; selectsAllSkills: boolean; selectedSkills: string[]; selectedSkillIds: string[]; selectedMisconceptions: string[]; selectedMisconceptionIds: string[] };

type KnowledgeGenerationContextValue = {
  mode: ActivityKnowledgeGenerationMode;
  setMode: (mode: ActivityKnowledgeGenerationMode) => void;
  request: ActivityKnowledgeGenerationRequest;
  applySelections: (selections: GeneratedKnowledgeSelection[] | undefined) => void;
};

const KnowledgeGenerationContext = createContext<KnowledgeGenerationContextValue>({
  mode: "ignore",
  setMode: () => undefined,
  request: { mode: "ignore", concepts: [] },
  applySelections: () => undefined
});

export function ActivityKnowledgeGenerationProvider({ value, children }: { value: KnowledgeGenerationContextValue; children: ReactNode }) {
  return <KnowledgeGenerationContext.Provider value={value}>{children}</KnowledgeGenerationContext.Provider>;
}

export function useActivityKnowledgeGeneration() {
  return useContext(KnowledgeGenerationContext);
}

export function KnowledgeGenerationModeField({
  locale = "en"
}: {
  locale?: string;
}) {
  const knowledge = useActivityKnowledgeGeneration();
  const labels = knowledgeGenerationCopy[locale as keyof typeof knowledgeGenerationCopy] ?? knowledgeGenerationCopy.en;
  return (
    <div className="field">
      <label>{labels.title}</label>
      <select value={knowledge.mode} onChange={(event) => knowledge.setMode(event.target.value as ActivityKnowledgeGenerationMode)}>
        <option value="selected">{labels.selected}</option>
        <option value="suggest">{labels.suggest}</option>
        <option value="ignore">{labels.ignore}</option>
      </select>
      <p className="muted">{labels.help}</p>
    </div>
  );
}

const knowledgeGenerationCopy = {
  en: { title: "Knowledge alignment", selected: "Use selected targets", suggest: "Suggest targets", ignore: "Ignore targets", help: "Choose how this AI generation uses the activity's skills and misconceptions." },
  fr: { title: "Alignement des connaissances", selected: "Utiliser les cibles choisies", suggest: "Suggérer des cibles", ignore: "Ignorer les cibles", help: "Choisissez comment cette génération utilise les compétences et les conceptions erronées de l’activité." },
  zh: { title: "知识关联", selected: "使用已选目标", suggest: "推荐目标", ignore: "忽略目标", help: "选择此次 AI 生成如何使用活动的技能和错误观念。" },
  ar: { title: "مواءمة المعرفة", selected: "استخدام الأهداف المحددة", suggest: "اقتراح أهداف", ignore: "تجاهل الأهداف", help: "اختر كيفية استخدام توليد الذكاء الاصطناعي للمهارات والمفاهيم الخاطئة في النشاط." }
} as const;
