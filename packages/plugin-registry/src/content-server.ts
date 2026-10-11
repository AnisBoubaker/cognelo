import { registerServerContentTypePlugins } from "@cognelo/content-type-sdk/server";
import { fileContentServerPlugin } from "@cognelo/plugin-file-content/server";
import { githubRepoContentServerPlugin } from "@cognelo/plugin-github-repo/server";
import { textContentServerPlugin } from "@cognelo/plugin-text-content/server";
import "./content";

export const installedServerContentTypePlugins = [
  githubRepoContentServerPlugin,
  fileContentServerPlugin,
  textContentServerPlugin
] as const;

registerServerContentTypePlugins(installedServerContentTypePlugins);
