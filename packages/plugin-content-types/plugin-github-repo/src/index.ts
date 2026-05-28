import type { ContentTypePlugin } from "@cognelo/content-type-sdk";
import { githubRepoContentDatabaseModule } from "./db";

export const githubRepoContentPlugin: ContentTypePlugin = {
  key: "github-repo-content",
  packageName: "@cognelo/plugin-github-repo",
  name: "GitHub repo content",
  version: "0.1.0",
  db: githubRepoContentDatabaseModule,
  contentTypes: [
    {
      key: "github-repo",
      label: {
        default: "GitHub repo",
        i18n: {
          fr: "Depot GitHub",
          zh: "GitHub 仓库",
          ar: "GitHub repo"
        }
      },
      description: {
        default: "Link a repository with examples, starter code, or reference material.",
        i18n: {
          fr: "Liez un depot contenant des exemples, du code de depart ou des ressources de reference.",
          zh: "链接包含示例、起始代码或参考资料的仓库。",
          ar: "اربط مستودعا يحتوي على أمثلة أو تعليمات برمجية أولية أو مواد مرجعية."
        }
      },
      defaultTitle: {
        default: "GitHub repository",
        i18n: {
          fr: "Depot GitHub",
          zh: "GitHub 仓库",
          ar: "GitHub repo"
        }
      },
      icon: "github",
      createMode: "shell",
      embeddingSource: "external_url",
      settingsRendererKey: "github-repo-settings"
    }
  ]
};

export { normalizeGithubRepoUrl } from "./shared";
export { GithubRepoSettingsForm, type GithubRepoSettingsFormProps } from "./settings";
