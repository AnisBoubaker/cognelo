import React, { type ReactNode } from "react";
import type { ContentPluginLocale, ContentResourcePresentation, ContentTypeDefinition } from "@cognelo/content-type-sdk";
import "@cognelo/plugin-registry/content";
import { FileContentSettingsForm } from "@cognelo/plugin-file-content";
import { GithubRepoSettingsForm } from "@cognelo/plugin-github-repo";
import { TextContentSettingsForm } from "@cognelo/plugin-text-content";
import { getLinkContentPresentation, LinkContentSettingsForm } from "@cognelo/plugin-link-content";
import type { CourseContentItem, CourseContentResource } from "./api";
export { ContentTypeIcon } from "../components/app-icon";

export type ContentTypeSettingsState = {
  title: string;
  url: string;
  body: string;
  metadata: Record<string, unknown>;
  detail?: string;
  error?: string;
  onTitleChange: (title: string) => void;
  onUrlChange: (url: string) => void;
  onBodyChange: (body: string) => void;
  onMetadataChange: (metadata: Record<string, unknown>) => void;
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
  "link-content-settings": (context) => context.settings ? <LinkContentSettingsForm
    title={context.settings.title}
    url={context.settings.url}
    metadata={context.settings.metadata}
    locale={context.locale}
    error={context.settings.error}
    onTitleChange={context.settings.onTitleChange}
    onUrlChange={context.settings.onUrlChange}
    onMetadataChange={context.settings.onMetadataChange}
    onSubmit={context.settings.onSubmit}
    t={context.t}
  /> : null,
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

const contentPresentations: Record<string, (resource: CourseContentResource) => ContentResourcePresentation> = {
  "link-content-presentation": (resource) => getLinkContentPresentation(resource.metadata)
};

export function resolveContentResourcePresentation(definition: ContentTypeDefinition | null | undefined, resource: CourseContentResource | null | undefined) {
  return resource && definition?.presentationRendererKey
    ? contentPresentations[definition.presentationRendererKey]?.(resource) ?? null
    : null;
}

export function resolveContentTypeRenderer(rendererKey: string | null | undefined) {
  return rendererKey ? contentTypeRenderers[rendererKey] ?? null : null;
}

export function resolveContentTypeSettingsRenderer(rendererKey: string | null | undefined) {
  return rendererKey ? contentTypeSettingsRenderers[rendererKey] ?? null : null;
}
