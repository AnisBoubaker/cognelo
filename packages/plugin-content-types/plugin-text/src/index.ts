import type { ContentTypePlugin } from "@cognelo/content-type-sdk";
import { textContentDatabaseModule } from "./db";

export const textContentPlugin: ContentTypePlugin = {
  key: "text-content",
  packageName: "@cognelo/plugin-text-content",
  name: "Text content",
  version: "0.1.0",
  db: textContentDatabaseModule,
  contentTypes: [
    {
      key: "text",
      label: { default: "Text", i18n: { fr: "Texte", zh: "文本", ar: "نص" } },
      description: { default: "Write instructions, notes, or theory directly in Cognelo." },
      defaultTitle: { default: "Text note" },
      icon: "text",
      createMode: "shell",
      embeddingSource: "text_body",
      settingsRendererKey: "text-content-settings"
    }
  ]
};

export { TextContentSettingsForm, type TextContentSettingsFormProps } from "./settings";
