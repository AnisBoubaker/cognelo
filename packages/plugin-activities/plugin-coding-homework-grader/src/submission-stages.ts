import type { SubmissionStageDefinition } from "@cognelo/activity-sdk";
export const homeworkSubmissionStages = [
  { id: "files", names: { en: "File submission", fr: "Remise des fichiers", zh: "文件提交", ar: "تسليم الملفات" }, allowsLateSubmissions: true },
  { id: "questions", names: { en: "Questions answering", fr: "Réponses aux questions", zh: "问题作答", ar: "الإجابة عن الأسئلة" }, assessment: true }
] satisfies SubmissionStageDefinition[];
