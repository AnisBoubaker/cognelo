import { registerContentTypePlugins } from "@cognelo/content-type-sdk";
import { fileContentPlugin } from "@cognelo/plugin-file-content";
import { githubRepoContentPlugin } from "@cognelo/plugin-github-repo";
import { textContentPlugin } from "@cognelo/plugin-text-content";
import { linkContentPlugin } from "@cognelo/plugin-link-content";

export const installedContentTypePlugins = [
  githubRepoContentPlugin,
  fileContentPlugin,
  textContentPlugin,
  linkContentPlugin
] as const;

registerContentTypePlugins(installedContentTypePlugins);
