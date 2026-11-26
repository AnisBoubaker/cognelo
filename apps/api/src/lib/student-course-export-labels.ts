import type { StudentCourseExportLabels } from "@cognelo/core";
import { answerExportLabels } from "./answer-export-labels";

const extra = {
  en: { contents: "Course contents", exported: "Exported", noSubmissions: "No submitted attempts available for export.", contentClosed: "This activity's prompts and answers are not currently available.", unsupported: "Additional content for this item is not available in the export." },
  fr: { contents: "Contenu du cours", exported: "Exporté le", noSubmissions: "Aucune tentative remise n’est disponible pour l’exportation.", contentClosed: "Les énoncés et réponses de cette activité ne sont pas accessibles actuellement.", unsupported: "Le contenu supplémentaire de cet élément n’est pas disponible pour l’exportation." },
  zh: { contents: "课程内容", exported: "导出时间", noSubmissions: "没有可供导出的已提交作答。", contentClosed: "此活动的题目和答案目前不可访问。", unsupported: "此项目的其他内容无法导出。" },
  ar: { contents: "محتوى المقرر", exported: "تاريخ التصدير", noSubmissions: "لا توجد محاولات مسلّمة متاحة للتصدير.", contentClosed: "أسئلة هذا النشاط وإجاباته غير متاحة حاليًا.", unsupported: "المحتوى الإضافي لهذا العنصر غير متاح للتصدير." }
};
export function studentCourseExportLabels(locale: string): StudentCourseExportLabels {
  return { ...answerExportLabels(locale), ...(extra[locale as keyof typeof extra] ?? extra.en) };
}
