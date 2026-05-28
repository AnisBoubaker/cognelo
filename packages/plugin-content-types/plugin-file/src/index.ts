import type { ContentTypePlugin } from "@cognelo/content-type-sdk";
import { fileContentDatabaseModule } from "./db";

export const fileContentPlugin: ContentTypePlugin = {
  key: "file-content",
  packageName: "@cognelo/plugin-file-content",
  name: "File content",
  version: "0.1.0",
  db: fileContentDatabaseModule,
  contentTypes: [
    {
      key: "file",
      label: { default: "File", i18n: { fr: "Fichier", zh: "文件", ar: "ملف" } },
      description: { default: "Upload a PDF, slide deck, worksheet, or other course file." },
      defaultTitle: { default: "File" },
      icon: "file",
      createMode: "upload",
      embeddingSource: "file_upload",
      settingsRendererKey: "file-content-settings"
    }
  ]
};

export { FileContentSettingsForm, type FileContentSettingsFormProps } from "./settings";
