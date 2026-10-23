"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ActionIcon, ProgressDialog } from "@cognelo/activity-ui";
import type { ContentPluginLocale } from "@cognelo/content-type-sdk";
import { linkUrlSchema, MAX_SUMMARY_LINKED_PAGES, type LinkSummaryResult, type LinkSummarySources } from "./shared";

const copy = {
  en: {
    followLinks: "Follow one level of same domain links",
    followHelp: "Includes the main page and up to {limit} directly linked pages on the same hostname.",
    sourcesIncluded: "Pages summarized: {count}.",
    sourcesUnavailable: "Linked pages that could not be read: {count}.",
    sourcesOmitted: "Links beyond the {limit}-page limit: {count}.",
    sourcesShortened: "Some page text was shortened to fit the summary source limit.",
    crawlProgress: "Checking the URL and summarizing linked pages…",

    text: "Link text", url: "URL", description: "Description (optional)", newTab: "Open in a new tab",
    summary: "Internal summary", summaryHelp: "For teachers only. AI generation uses the course language. Review and edit the text before saving.",
    maxWords: "Maximum words", generate: "Generate with AI", generating: "Generating internal summary", progress: "Checking the URL and summarizing the page…",
    loadError: "Unable to load the internal summary.", generateError: "Unable to generate the summary. Your existing text has been kept.", retry: "Retry", loading: "Loading internal summary…",
    httpError: "The URL returned HTTP {status}. It must return HTTP 200 before AI generation.", publicError: "Only publicly reachable web pages can be summarized.",
    timeoutError: "The page took too long to respond. Try again or enter the summary yourself.", contentError: "This page does not provide supported HTML or plain text to summarize.",
    sizeError: "The page is too large to summarize.", emptyError: "The page does not contain enough readable text to summarize.",
    agentError: "Choose an AI agent in your account settings before generating a summary."
  },
  fr: {
    followLinks: "Suivre un niveau de liens du même domaine",
    followHelp: "Inclut la page principale et jusqu’à {limit} pages directement liées sur le même nom d’hôte.",
    sourcesIncluded: "Pages résumées : {count}.",
    sourcesUnavailable: "Pages liées impossibles à lire : {count}.",
    sourcesOmitted: "Liens dépassant la limite de {limit} pages : {count}.",
    sourcesShortened: "Le texte de certaines pages a été raccourci pour respecter la limite des sources.",
    crawlProgress: "Vérification de l’URL et résumé des pages liées…",

    text: "Texte du lien", url: "URL", description: "Description (facultative)", newTab: "Ouvrir dans un nouvel onglet",
    summary: "Résumé interne", summaryHelp: "Réservé aux enseignants. La génération utilise la langue du cours. Relisez et modifiez le texte avant d’enregistrer.",
    maxWords: "Nombre maximal de mots", generate: "Générer avec l’IA", generating: "Génération du résumé interne", progress: "Vérification de l’URL et résumé de la page…",
    loadError: "Impossible de charger le résumé interne.", generateError: "Impossible de générer le résumé. Votre texte existant a été conservé.", retry: "Réessayer", loading: "Chargement du résumé interne…",
    httpError: "L’URL a retourné le code HTTP {status}. Le code HTTP 200 est requis avant la génération par IA.", publicError: "Seules les pages web accessibles publiquement peuvent être résumées.",
    timeoutError: "La page met trop de temps à répondre. Réessayez ou saisissez le résumé vous-même.", contentError: "Cette page ne fournit pas de contenu HTML ou texte pris en charge.",
    sizeError: "La page est trop volumineuse pour être résumée.", emptyError: "La page ne contient pas assez de texte lisible à résumer.",
    agentError: "Choisissez un agent IA dans les paramètres de votre compte avant de générer un résumé."
  },
  zh: {
    followLinks: "跟随同一域名下的一层链接",
    followHelp: "包括主页以及同一主机名下最多 {limit} 个直接链接的页面。",
    sourcesIncluded: "已总结页面数：{count}。",
    sourcesUnavailable: "无法读取的链接页面数：{count}。",
    sourcesOmitted: "超出 {limit} 页限制的链接数：{count}。",
    sourcesShortened: "部分页面文本已缩短，以符合摘要来源长度限制。",
    crawlProgress: "正在检查网址并总结链接页面…",

    text: "链接文字", url: "网址", description: "说明（可选）", newTab: "在新标签页中打开",
    summary: "内部摘要", summaryHelp: "仅供教师查看。AI 将使用课程语言生成内容。保存前请检查并编辑文本。",
    maxWords: "最大词数", generate: "使用 AI 生成", generating: "正在生成内部摘要", progress: "正在检查网址并总结页面…",
    loadError: "无法加载内部摘要。", generateError: "无法生成摘要，现有文本已保留。", retry: "重试", loading: "正在加载内部摘要…",
    httpError: "网址返回 HTTP {status}。只有返回 HTTP 200 才能调用 AI。", publicError: "只能总结公开可访问的网页。",
    timeoutError: "页面响应超时，请重试或手动输入摘要。", contentError: "该页面没有受支持的 HTML 或纯文本内容。",
    sizeError: "页面过大，无法总结。", emptyError: "页面没有足够的可读文本。",
    agentError: "请先在账户设置中选择 AI 代理。"
  },
  ar: {
    followLinks: "اتباع مستوى واحد من روابط النطاق نفسه",
    followHelp: "يشمل الصفحة الرئيسية وما يصل إلى {limit} صفحة مرتبطة مباشرة باسم المضيف نفسه.",
    sourcesIncluded: "عدد الصفحات الملخصة: {count}.",
    sourcesUnavailable: "صفحات مرتبطة تعذرت قراءتها: {count}.",
    sourcesOmitted: "روابط تتجاوز حد {limit} صفحة: {count}.",
    sourcesShortened: "تم اختصار بعض نصوص الصفحات لتناسب حد مصادر الملخص.",
    crawlProgress: "جارٍ فحص الرابط وتلخيص الصفحات المرتبطة…",

    text: "نص الرابط", url: "عنوان URL", description: "الوصف (اختياري)", newTab: "فتح في علامة تبويب جديدة",
    summary: "ملخص داخلي", summaryHelp: "للمعلمين فقط. يستخدم التوليد لغة المقرر. راجع النص وعدّله قبل الحفظ.",
    maxWords: "الحد الأقصى للكلمات", generate: "توليد بالذكاء الاصطناعي", generating: "جارٍ توليد الملخص الداخلي", progress: "جارٍ فحص الرابط وتلخيص الصفحة…",
    loadError: "تعذر تحميل الملخص الداخلي.", generateError: "تعذر توليد الملخص. تم الاحتفاظ بالنص الحالي.", retry: "إعادة المحاولة", loading: "جارٍ تحميل الملخص الداخلي…",
    httpError: "أعاد الرابط HTTP {status}. يجب أن يعيد HTTP 200 قبل استخدام الذكاء الاصطناعي.", publicError: "يمكن تلخيص صفحات الويب المتاحة للعامة فقط.",
    timeoutError: "استغرقت الصفحة وقتًا طويلًا. أعد المحاولة أو اكتب الملخص بنفسك.", contentError: "لا توفر الصفحة محتوى HTML أو نصًا عاديًا مدعومًا.",
    sizeError: "الصفحة أكبر من أن يتم تلخيصها.", emptyError: "لا تحتوي الصفحة على نص مقروء كافٍ.",
    agentError: "اختر وكيل ذكاء اصطناعي في إعدادات حسابك أولًا."
  }
};

type InternalSettings = { internalSummary: string; maxWords: number; followSameDomainLinks: boolean };

export function LinkContentSettingsForm({ resourceId, title, url, metadata, locale, error, onTitleChange, onUrlChange, onMetadataChange, onSubmit, loadInternalSettings, generateInternalSummary, t }: {
  resourceId: string; title: string; url: string; metadata: Record<string, unknown>; locale: ContentPluginLocale; error?: string;
  onTitleChange: (value: string) => void; onUrlChange: (value: string) => void;
  onMetadataChange: (value: Record<string, unknown>) => void; onSubmit: (event: FormEvent) => void;
  loadInternalSettings: () => Promise<InternalSettings>;
  generateInternalSummary: (url: string, maxWords: number, followSameDomainLinks: boolean) => Promise<LinkSummaryResult>;
  t: (key: string) => string;
}) {
  const labels = copy[locale];
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [sources, setSources] = useState<LinkSummarySources | null>(null);
  const stateRef = useRef({ metadata, url, resourceId, onMetadataChange, loadInternalSettings });
  stateRef.current = { metadata, url, resourceId, onMetadataChange, loadInternalSettings };
  const mountedRef = useRef(false);
  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    setLoaded(false); setLoadFailed(false); setSummaryError(""); setSources(null);
    stateRef.current.loadInternalSettings().then((settings) => {
      if (!active) return;
      stateRef.current.onMetadataChange({ ...stateRef.current.metadata, internalSummary: settings.internalSummary, summaryMaxWords: settings.maxWords, summaryFollowSameDomainLinks: settings.followSameDomainLinks ?? false });
      setLoaded(true);
    }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; mountedRef.current = false; };
  }, [resourceId, retry]);

  const maxWords = typeof metadata.summaryMaxWords === "number" ? metadata.summaryMaxWords : 100;
  const followSameDomainLinks = metadata.summaryFollowSameDomainLinks === true;
  const validMaxWords = Number.isInteger(maxWords) && maxWords >= 1 && maxWords <= 2000;
  async function generate() {
    if (generating || !loaded || !validMaxWords || !linkUrlSchema.safeParse(url).success) return;
    setGenerating(true); setSummaryError(""); setSources(null);
    try {
      const result = await generateInternalSummary(url, maxWords, followSameDomainLinks);
      if (mountedRef.current && stateRef.current.resourceId === resourceId && stateRef.current.url === url) {
        stateRef.current.onMetadataChange({ ...stateRef.current.metadata, internalSummary: result.summary, summaryMaxWords: maxWords });
        setSources(result.sources ?? null);
      }
    } catch (caught) {
      if (mountedRef.current) {
        const reason = caught as { code?: string; details?: { status?: number } } | null;
        const messages: Record<string, string> = {
          LINK_URL_NOT_PUBLIC: labels.publicError, LINK_FETCH_TIMEOUT: labels.timeoutError,
          LINK_UNSUPPORTED_CONTENT: labels.contentError, LINK_PAGE_TOO_LARGE: labels.sizeError,
          LINK_NO_READABLE_TEXT: labels.emptyError, AI_AGENT_NOT_CONFIGURED: labels.agentError,
          AI_AGENT_KEY_MISSING: labels.agentError
        };
        setSummaryError(reason?.code === "LINK_HTTP_STATUS" ? labels.httpError.replace("{status}", String(reason.details?.status ?? "—")) : messages[reason?.code ?? ""] ?? labels.generateError);
      }
    } finally { if (mountedRef.current) setGenerating(false); }
  }

  return <>
    <form className="form" onSubmit={onSubmit}>
      <div className="field"><label htmlFor="settings-link-text">{labels.text}</label><input id="settings-link-text" value={title} onChange={(event) => onTitleChange(event.target.value)} required maxLength={180} /></div>
      <div className="field"><label htmlFor="settings-link-url">{labels.url}</label><input id="settings-link-url" type="url" value={url} onChange={(event) => onUrlChange(event.target.value)} required maxLength={4000} placeholder="https://example.org" /></div>
      <div className="field"><label htmlFor="settings-link-description">{labels.description}</label><textarea id="settings-link-description" value={typeof metadata.description === "string" ? metadata.description : ""} onChange={(event) => onMetadataChange({ ...metadata, description: event.target.value })} maxLength={2000} rows={3} /></div>
      <label className="checkbox-row"><input type="checkbox" checked={metadata.openInNewTab !== false} onChange={(event) => onMetadataChange({ ...metadata, openInNewTab: event.target.checked })} />{labels.newTab}</label>
      <div className="field">
        <label htmlFor="settings-link-summary">{labels.summary}</label>
        <textarea id="settings-link-summary" rows={5} maxLength={20_000} disabled={!loaded || generating} value={typeof metadata.internalSummary === "string" ? metadata.internalSummary : ""} onChange={(event) => onMetadataChange({ ...metadata, internalSummary: event.target.value })} />
        <p className="muted">{labels.summaryHelp}</p>
      </div>
      <div className="field">
        <label className="checkbox-row"><input type="checkbox" checked={followSameDomainLinks} disabled={!loaded || generating} onChange={(event) => onMetadataChange({ ...metadata, summaryFollowSameDomainLinks: event.target.checked })} />{labels.followLinks}</label>
        <p className="muted">{labels.followHelp.replace("{limit}", String(MAX_SUMMARY_LINKED_PAGES))}</p>
      </div>
      <div className="row" style={{ alignItems: "end" }}>
        <div className="field" style={{ maxWidth: "12rem" }}><label htmlFor="settings-link-max-words">{labels.maxWords}</label><input id="settings-link-max-words" type="number" min={1} max={2000} required disabled={!loaded || generating} value={Number.isFinite(maxWords) ? maxWords : ""} onChange={(event) => onMetadataChange({ ...metadata, summaryMaxWords: event.target.valueAsNumber })} /></div>
        <button className="secondary" type="button" disabled={!loaded || generating || !validMaxWords || !linkUrlSchema.safeParse(url).success} onClick={() => void generate()}><ActionIcon name="generate" /> {labels.generate}</button>
      </div>
      {!loaded ? <p className="muted">{loadFailed ? labels.loadError : labels.loading}</p> : null}
      {loadFailed ? <button className="secondary" type="button" onClick={() => setRetry((current) => current + 1)}><ActionIcon name="refresh" /> {labels.retry}</button> : null}
      {sources ? <p className="muted" role="status">{[
        labels.sourcesIncluded.replace("{count}", String(sources.includedPages)),
        sources.unavailablePages ? labels.sourcesUnavailable.replace("{count}", String(sources.unavailablePages)) : "",
        sources.omittedPages ? labels.sourcesOmitted.replace("{count}", String(sources.omittedPages)).replace("{limit}", String(MAX_SUMMARY_LINKED_PAGES)) : "",
        sources.shortened ? labels.sourcesShortened : ""
      ].filter(Boolean).join(" ")}</p> : null}
      {summaryError ? <p className="error" role="alert">{summaryError}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="row"><button type="submit" disabled={generating || !loaded}><ActionIcon name="save" /> {t("courseDetail.saveMaterial")}</button></div>
    </form>
    <ProgressDialog open={generating} title={labels.generating} message={followSameDomainLinks ? labels.crawlProgress : labels.progress} progressLabel={labels.generating} />
  </>;
}
