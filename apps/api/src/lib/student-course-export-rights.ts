import type { StudentCourseExportBundle } from "@cognelo/core";
import { escapeExportHtml as escape, exportDocumentHtml } from "./answer-export-pdf";

const translations = {
  en: { title: "Rights of use", student: "Downloaded by", terms: "Usage rights", empty: "No additional usage terms have been specified.", before: "This copyrighted material was downloaded with appropriate usage rights by ", after: ". All rights reserved to the copyright owners." },
  fr: { title: "Droits d’utilisation", student: "Téléchargé par", terms: "Droits d’utilisation", empty: "Aucune condition d’utilisation supplémentaire n’a été précisée.", before: "Ce contenu protégé par le droit d’auteur a été téléchargé avec les droits d’utilisation appropriés par ", after: ". Tous droits réservés aux titulaires des droits d’auteur." },
  zh: { title: "使用权", student: "下载人", terms: "使用权", empty: "未指定其他使用条款。", before: "本受版权保护的材料由", after: "依照相应使用权下载。所有权利由版权所有者保留。" },
  ar: { title: "حقوق الاستخدام", student: "نزّله", terms: "حقوق الاستخدام", empty: "لم تُحدّد شروط استخدام إضافية.", before: "نزّل ", after: " هذه المادة المحمية بحقوق النشر بموجب حقوق الاستخدام المناسبة. جميع الحقوق محفوظة لأصحاب حقوق النشر." }
};
export const studentCourseRightsLabels = (data: StudentCourseExportBundle) => translations[data.rights.locale];
export function studentCourseCopyrightHtml(data: StudentCourseExportBundle) {
  const copy = studentCourseRightsLabels(data);
  return `${escape(copy.before)}<bdi dir="auto">${escape(data.studentName)}</bdi>${escape(copy.after)}`;
}
export function studentCoursePageNotice(data: StudentCourseExportBundle, pageNumbers: boolean) {
  return { bottomMarginMm: 28, footerHtml: `<div dir="${data.rights.locale === "ar" ? "rtl" : "ltr"}" style="font:9px Arial,'Noto Sans','Noto Sans CJK SC',sans-serif;color:#505a6d;text-align:center;width:100%;padding:0 15mm;overflow-wrap:anywhere;line-height:1.35"><div>${studentCourseCopyrightHtml(data)}</div><div style="margin-top:4px;min-height:12px" dir="ltr">${pageNumbers ? '<span class="pageNumber"></span> / <span class="totalPages"></span>' : "&nbsp;"}</div></div>` };
}
export function studentCourseWatermarkHtml(html: string, confidential: boolean) {
  if (!confidential) return html;
  return html.replace("</body>", '<div aria-hidden="true" style="position:fixed;top:45%;left:0;width:100%;text-align:center;transform:rotate(-35deg);font:bold 68pt Arial,sans-serif;color:#666;opacity:0.12;z-index:1000;pointer-events:none">Confidential</div></body>');
}
export function studentCourseRightsHtml(data: StudentCourseExportBundle, css: string) {
  const copy = studentCourseRightsLabels(data);
  const body = `<article><header><p class="course">${escape(data.subjectTitle)}</p><h1>${escape(copy.title)}</h1><p>${escape(data.courseTitle)}</p><p>${escape(copy.student)}: <bdi dir="auto">${escape(data.studentName)}</bdi></p></header>
    <h2>${escape(copy.terms)}</h2><div style="white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext">${escape(data.rights.usageRights || copy.empty)}</div>
    <p style="margin-top:20px">${studentCourseCopyrightHtml(data)}</p></article>`;
  return exportDocumentHtml(copy.title, data.rights.locale, body, css);
}
