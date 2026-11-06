import type { CodingHomeworkLocale } from "./messages";
const en = {
  title: "Submission deadline", deadline: "Submission deadline", optional: "Leave blank for no deadline.", allowLate: "Allow late submissions", limitLate: "Limit the late-submission period", days: "Days", hours: "Hours", minutes: "Minutes", save: "Save deadline settings",
  help: "The late-submission period starts at the deadline. This applies to handing in files; activity availability, the teacher's submission switch and challenge-answer timing still apply.",
  invalidDeadline: "Enter a valid submission date and time.", invalidDuration: "Enter a positive duration using up to 3650 days, 23 hours and 59 minutes (at most 3650 days total).",
  closes: "Late submissions accepted until", unlimited: "Late submissions are allowed without an additional time limit.", noLate: "Late submissions are not allowed.", closed: "The deadline for submitting your work has passed.", lateNow: "Your work will be marked as a late submission.", lateBy: "Late by {duration}"
};
const fr: typeof en = {
  title: "Date limite de remise", deadline: "Date limite de remise", optional: "Laissez vide pour ne pas fixer de date limite.", allowLate: "Autoriser les remises en retard", limitLate: "Limiter la période de remise en retard", days: "Jours", hours: "Heures", minutes: "Minutes", save: "Enregistrer les paramètres de remise",
  help: "La période de retard commence à la date limite. Elle concerne la remise des fichiers ; la disponibilité de l’activité, l’ouverture des remises par l’enseignant et le temps de réponse aux questions continuent de s’appliquer.",
  invalidDeadline: "Saisissez une date et une heure de remise valides.", invalidDuration: "Saisissez une durée positive avec au plus 3650 jours, 23 heures et 59 minutes (3650 jours au total).",
  closes: "Remises en retard acceptées jusqu’au", unlimited: "Les remises en retard sont autorisées sans limite de temps supplémentaire.", noLate: "Les remises en retard ne sont pas autorisées.", closed: "La date limite pour remettre votre travail est dépassée.", lateNow: "Votre travail sera indiqué comme remis en retard.", lateBy: "Retard de {duration}"
};
const zh: typeof en = {
  title: "提交截止时间", deadline: "提交截止时间", optional: "留空则不设截止时间。", allowLate: "允许迟交", limitLate: "限制迟交期限", days: "天", hours: "小时", minutes: "分钟", save: "保存截止时间设置",
  help: "迟交期限从截止时间起算，仅适用于提交文件。活动开放时间、教师的提交开关和挑战问题作答时间仍然有效。", invalidDeadline: "请输入有效的提交日期和时间。", invalidDuration: "请输入正时长：天数最多3650，小时最多23，分钟最多59，总计不超过3650天。",
  closes: "迟交接受至", unlimited: "允许迟交，不设额外时限。", noLate: "不允许迟交。", closed: "提交作业的截止时间已过。", lateNow: "你的作业将被标记为迟交。", lateBy: "迟交了{duration}"
};
const ar: typeof en = {
  title: "الموعد النهائي للتسليم", deadline: "الموعد النهائي للتسليم", optional: "اتركه فارغاً لعدم تحديد موعد نهائي.", allowLate: "السماح بالتسليم المتأخر", limitLate: "تحديد مدة التسليم المتأخر", days: "أيام", hours: "ساعات", minutes: "دقائق", save: "حفظ إعدادات موعد التسليم",
  help: "تبدأ فترة التأخير من الموعد النهائي وتخص تسليم الملفات. تظل إتاحة النشاط وفتح التسليم من المعلم ووقت الإجابة عن الأسئلة سارية.", invalidDeadline: "أدخل تاريخاً ووقتاً صالحين للتسليم.", invalidDuration: "أدخل مدة موجبة لا تتجاوز 3650 يوماً و23 ساعة و59 دقيقة، وبإجمالي أقصاه 3650 يوماً.",
  closes: "يُقبل التسليم المتأخر حتى", unlimited: "يُسمح بالتسليم المتأخر دون حد زمني إضافي.", noLate: "لا يُسمح بالتسليم المتأخر.", closed: "انتهى الموعد النهائي لتسليم عملك.", lateNow: "سيُسجّل عملك كتسليم متأخر.", lateBy: "متأخر بمقدار {duration}"
};
export const submissionDeadlineCopy = (locale: CodingHomeworkLocale) => ({ en, fr, zh, ar })[locale] ?? en;
