"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ActivityKnowledgeGenerationMode = "selected" | "suggest" | "ignore";
export type ActivityKnowledgeGenerationConcept = { id: string; title: string; skills: string[]; skillIds: string[] };
export type ActivityKnowledgeGenerationRequest =
  | { mode: "selected"; concepts: ActivityKnowledgeGenerationConcept[]; selectedConcepts: ActivityKnowledgeGenerationConcept[] }
  | { mode: "suggest"; concepts: ActivityKnowledgeGenerationConcept[] }
  | { mode: "ignore"; concepts: ActivityKnowledgeGenerationConcept[] };
export type GeneratedKnowledgeSelection = { conceptId: string; selectsAllSkills: boolean; selectedSkills: string[]; selectedSkillIds: string[] };

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
  en: { title: "Knowledge alignment", selected: "Use selected skills", suggest: "Suggest skills", ignore: "Ignore skills", help: "Choose how this AI generation uses the activity's knowledge links." },
  fr: { title: "Alignement des connaissances", selected: "Utiliser les compétences choisies", suggest: "Suggérer des compétences", ignore: "Ignorer les compétences", help: "Choisissez comment cette génération utilise les liens de connaissances de l’activité." },
  zh: { title: "知识关联", selected: "使用已选技能", suggest: "推荐技能", ignore: "忽略技能", help: "选择此次 AI 生成如何使用活动的知识关联。" },
  ar: { title: "مواءمة المعرفة", selected: "استخدام المهارات المحددة", suggest: "اقتراح مهارات", ignore: "تجاهل المهارات", help: "اختر كيفية استخدام توليد الذكاء الاصطناعي لروابط المعرفة في النشاط." }
} as const;
