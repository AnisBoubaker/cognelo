import type { ContentPluginLocale } from "@cognelo/content-type-sdk";
const copy = {
  en: { title: "Title", content: "Content", display: "Student display", inline: "On the course content page", page: "On a separate page", modal: "In a modal window", newTab: "Open in a new tab", visible: "Visible to students", settings: "Settings", edit: "Edit text", saved: "Text material saved.", save: "Save material" },
  fr: { title: "Titre", content: "Contenu", display: "Affichage pour les étudiants", inline: "Sur la page du contenu du cours", page: "Sur une page distincte", modal: "Dans une fenêtre modale", newTab: "Ouvrir dans un nouvel onglet", visible: "Visible pour les étudiants", settings: "Paramètres", edit: "Modifier le texte", saved: "Texte enregistré.", save: "Enregistrer le matériel" },
  zh: { title: "标题", content: "内容", display: "学生显示方式", inline: "在课程内容页面上", page: "在独立页面上", modal: "在模态窗口中", newTab: "在新标签页打开", visible: "对学生可见", settings: "设置", edit: "编辑文本", saved: "文本资料已保存。", save: "保存资料" },
  ar: { title: "العنوان", content: "المحتوى", display: "العرض للطلاب", inline: "في صفحة محتوى المقرر", page: "في صفحة منفصلة", modal: "في نافذة حوار", newTab: "فتح في علامة تبويب جديدة", visible: "مرئي للطلاب", settings: "الإعدادات", edit: "تحرير النص", saved: "تم حفظ المادة النصية.", save: "حفظ المادة" }
};
export function textContentCopy(locale: ContentPluginLocale) { return copy[locale] ?? copy.en; }
