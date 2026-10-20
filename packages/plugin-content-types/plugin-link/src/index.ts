import type { ContentTypePlugin } from "@cognelo/content-type-sdk";

export const linkContentPlugin: ContentTypePlugin = {
  key: "link-content",
  packageName: "@cognelo/plugin-link-content",
  name: "Link content",
  version: "0.1.0",
  db: { namespace: "plugin_link_content", tables: [], notes: ["Link metadata is stored in CourseContentResource."] },
  contentTypes: [{
    key: "link",
    label: { default: "Link", i18n: { fr: "Lien", zh: "链接", ar: "رابط" } },
    description: { default: "Add a web link with an optional description.", i18n: { fr: "Ajoutez un lien web avec une description facultative.", zh: "添加网页链接和可选说明。", ar: "أضف رابط ويب مع وصف اختياري." } },
    defaultTitle: { default: "Link", i18n: { fr: "Lien", zh: "链接", ar: "رابط" } },
    icon: "link",
    createMode: "shell",
    embeddingSource: "external_url",
    settingsRendererKey: "link-content-settings",
    presentationRendererKey: "link-content-presentation"
  }]
};

export { LinkContentSettingsForm } from "./settings";
export { getLinkContentPresentation } from "./shared";
