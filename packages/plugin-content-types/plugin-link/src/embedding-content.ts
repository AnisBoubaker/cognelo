import { Parser } from "htmlparser2";
import { AppError } from "@cognelo/core";

/** Extract lesson text, not page chrome or a title-only application shell. */
export function extractHtmlMaterialContent(html: string) {
  const ignoredTags = new Set(["head", "title", "nav", "header", "footer", "form", "button", "select", "style", "noscript", "svg", "canvas", "iframe", "object"]);
  const frames: Array<{ ignored: boolean; main: boolean; heading: boolean; link: boolean }> = [];
  const body: string[] = [], main: string[] = [], evidence: string[] = [], mainEvidence: string[] = [];
  let hasMain = false;
  const parser = new Parser({
    onopentag(name, attrs) {
      const parent = frames.at(-1);
      const ignored = Boolean(parent?.ignored) || ignoredTags.has(name) || Object.hasOwn(attrs, "hidden") || attrs["aria-hidden"] === "true"
        || ["navigation", "banner", "contentinfo", "dialog", "progressbar"].includes(attrs.role)
        || (name === "script" && !["text/template", "text/markdown"].includes(attrs.type));
      const inMain = Boolean(parent?.main) || name === "main" || name === "article";
      if (inMain && !ignored) hasMain = true;
      frames.push({ ignored, main: inMain, heading: Boolean(parent?.heading) || /^h[1-6]$/.test(name), link: Boolean(parent?.link) || name === "a" });
      if (!ignored) { body.push("\n"); if (inMain) main.push("\n"); }
    },
    ontext(value) {
      const frame = frames.at(-1);
      if (frame?.ignored) return;
      body.push(value); if (frame?.main) main.push(value);
      if (!frame?.heading && !frame?.link) { evidence.push(value); if (frame?.main) mainEvidence.push(value); }
    },
    onclosetag() { const frame = frames.pop(); if (!frame?.ignored) { body.push("\n"); if (frame?.main) main.push("\n"); } }
  }, { decodeEntities: true });
  parser.end(html);
  const normalize = (parts: string[]) => parts.join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text: normalize(hasMain ? main : body), evidence: normalize(hasMain ? mainEvidence : evidence) };
}

/** A conservative failure check, not a claim that arbitrary websites are complete. */
export function assertReadableLinkMaterial(text: string) {
  const evidence = text.replace(/^\s*#{1,6}\s+.*$/gm, "").replace(/\s+/g, " ").trim();
  const placeholder = /^(?:loading(?: (?:content|lesson|page))?|chargement(?: (?:du |de la )?(?:contenu|cours|page))?|please wait|veuillez patienter|加载中|正在加载|جار(?:ٍ|ي)? التحميل)[\s.!…]*$/iu;
  const accessShell = evidence.length < 240 && /^(?:(?:please |you (?:need|must) (?:to )?)?enable javascript|javascript (?:is )?(?:required|disabled)|(?:veuillez )?activer javascript|sign in to (?:continue|view)|log in to (?:continue|view)|checking your browser|verify (?:that )?you are human|just a moment)/iu.test(evidence);
  if (!evidence || placeholder.test(evidence) || accessShell) {
    throw new AppError(422, "MATERIAL_LINK_TEXT_INCOMPLETE", "This page did not expose readable teaching content. It may require JavaScript or a login. Use a public text/PDF version or upload the material.");
  }
}
