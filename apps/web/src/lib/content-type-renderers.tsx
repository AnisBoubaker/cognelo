import React, { type ReactNode } from "react";
import type { ContentPluginLocale, ContentTypeDefinition } from "@cognelo/content-type-sdk";
import { FileContentSettingsForm } from "@cognelo/plugin-file-content";
import { GithubRepoSettingsForm } from "@cognelo/plugin-github-repo";
import { TextContentSettingsForm } from "@cognelo/plugin-text-content";
import type { CourseContentItem, CourseContentResource } from "./api";
export { ContentTypeIcon } from "../components/app-icon";

export type ContentTypeSettingsState = {
  title: string;
  url: string;
  body: string;
  detail?: string;
  error?: string;
  onTitleChange: (title: string) => void;
  onUrlChange: (url: string) => void;
  onBodyChange: (body: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: React.FormEvent) => void;
};

export type ContentTypeRendererContext = {
  definition: ContentTypeDefinition;
  contentItem?: CourseContentItem;
  resource?: CourseContentResource | null;
  locale: ContentPluginLocale;
  settings?: ContentTypeSettingsState;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export type ContentTypeRenderer = (context: ContentTypeRendererContext) => ReactNode;

const contentTypeRenderers: Record<string, ContentTypeRenderer> = {};
const contentTypeSettingsRenderers: Record<string, ContentTypeRenderer> = {
  "file-content-settings": (context) =>
    context.settings ? (
      <FileContentSettingsForm
        title={context.settings.title}
        detail={context.settings.detail}
        error={context.settings.error}
        onTitleChange={context.settings.onTitleChange}
        onFileChange={context.settings.onFileChange}
        onSubmit={context.settings.onSubmit}
        t={context.t}
      />
    ) : null,
  "github-repo-settings": (context) =>
    context.settings ? (
      <GithubRepoSettingsForm
        title={context.settings.title}
        url={context.settings.url}
        error={context.settings.error}
        onTitleChange={context.settings.onTitleChange}
        onUrlChange={context.settings.onUrlChange}
        onSubmit={context.settings.onSubmit}
        t={context.t}
      />
    ) : null,
  "text-content-settings": (context) =>
    context.settings ? (
      <TextContentSettingsForm
        title={context.settings.title}
        body={context.settings.body}
        error={context.settings.error}
        onTitleChange={context.settings.onTitleChange}
        onBodyChange={context.settings.onBodyChange}
        onSubmit={context.settings.onSubmit}
        t={context.t}
      />
    ) : null
};

export function resolveContentTypeRenderer(rendererKey: string | null | undefined) {
  return rendererKey ? contentTypeRenderers[rendererKey] ?? null : null;
}

export function resolveContentTypeSettingsRenderer(rendererKey: string | null | undefined) {
  return rendererKey ? contentTypeSettingsRenderers[rendererKey] ?? null : null;
}
