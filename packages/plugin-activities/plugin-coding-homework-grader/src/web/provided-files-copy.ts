import type { CodingHomeworkLocale } from "./messages";
const en = {
  help: "Upload individual files or a ZIP. Individual files are added to the collection; matching paths require replacement confirmation. A ZIP replaces all provided files and preserves its folders. Changes are saved immediately.",
  empty: "No files provided with the assignment.",
  replaceTitle: "Replace provided files?",
  replaceZip: "Replace all files provided with the assignment with the contents of this ZIP?",
  replaceFiles: "Replace the provided files at these paths?",
  removeTitle: "Remove provided file?",
  removeFile: "Remove {path} from the files provided with the assignment?",
  removeAll: "Remove all files provided with the assignment?",
  saved: "Provided files updated.",
  limit: "Choose at most 1000 files and 25 MB per upload.",
  previewUnavailable: "A text preview is unavailable for this file."
};
const fr: typeof en = {
  help: "Téléversez des fichiers ou un ZIP. Les fichiers sont ajoutés à la collection ; leur remplacement nécessite une confirmation si le chemin existe déjà. Un ZIP remplace tous les fichiers fournis et conserve ses dossiers. Les changements sont enregistrés immédiatement.",
  empty: "Aucun fichier fourni avec le devoir.", replaceTitle: "Remplacer les fichiers fournis ?",
  replaceZip: "Remplacer tous les fichiers fournis avec le devoir par le contenu de ce ZIP ?", replaceFiles: "Remplacer les fichiers fournis à ces chemins ?",
  removeTitle: "Retirer le fichier fourni ?", removeFile: "Retirer {path} des fichiers fournis avec le devoir ?", removeAll: "Retirer tous les fichiers fournis avec le devoir ?",
  saved: "Fichiers fournis mis à jour.", limit: "Choisissez au plus 1000 fichiers et 25 Mo par téléversement.", previewUnavailable: "L’aperçu texte n’est pas disponible pour ce fichier."
};
const zh: typeof en = {
  help: "上传多个文件或 ZIP。单个文件会添加到集合中；替换相同路径的文件需要确认。ZIP 会替换所有提供的文件并保留文件夹。更改会立即保存。",
  empty: "尚未提供作业附带文件。", replaceTitle: "替换提供的文件？", replaceZip: "用此 ZIP 的内容替换所有作业附带文件？", replaceFiles: "替换以下路径的文件？",
  removeTitle: "移除提供的文件？", removeFile: "从作业附带文件中移除 {path}？", removeAll: "移除所有作业附带文件？", saved: "提供的文件已更新。", limit: "每次最多选择 1000 个文件，总大小不超过 25 MB。", previewUnavailable: "此文件不支持文本预览。"
};
const ar: typeof en = {
  help: "ارفع ملفات متعددة أو ملف ZIP. تُضاف الملفات المنفردة إلى المجموعة، ويتطلب استبدال المسارات الموجودة تأكيداً. يستبدل ZIP جميع الملفات المرفقة مع الحفاظ على المجلدات. تُحفظ التغييرات فوراً.",
  empty: "لا توجد ملفات مرفقة بالواجب.", replaceTitle: "استبدال الملفات المرفقة؟", replaceZip: "استبدال جميع ملفات الواجب المرفقة بمحتويات ملف ZIP هذا؟", replaceFiles: "استبدال الملفات المرفقة في هذه المسارات؟",
  removeTitle: "إزالة الملف المرفق؟", removeFile: "إزالة {path} من الملفات المرفقة بالواجب؟", removeAll: "إزالة جميع الملفات المرفقة بالواجب؟", saved: "تم تحديث الملفات المرفقة.", limit: "اختر ما لا يزيد عن 1000 ملف و25 ميغابايت لكل عملية رفع.", previewUnavailable: "المعاينة النصية غير متاحة لهذا الملف."
};
export function providedFilesCopy(locale: CodingHomeworkLocale) { return ({ en, fr, zh, ar })[locale]; }
