import type { GradebookActionDefinition } from "@cognelo/activity-sdk";
export const homeworkGradebookActions = [
  { id: "download-submitted-work", kind: "download", scope: "participant", labels: {
    en: "Download submitted files (ZIP)", fr: "Télécharger les fichiers remis (ZIP)", zh: "下载已提交文件（ZIP）", ar: "تنزيل الملفات المسلّمة (ZIP)"
  } },
  { id: "download-all-submitted-work", kind: "download", scope: "activity", labels: {
    en: "Download all submitted files (ZIP)", fr: "Télécharger tous les fichiers remis (ZIP)", zh: "下载所有已提交文件（ZIP）", ar: "تنزيل جميع الملفات المسلّمة (ZIP)"
  } }
] as const satisfies readonly GradebookActionDefinition[];
