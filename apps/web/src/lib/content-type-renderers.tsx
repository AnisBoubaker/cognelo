import React, { type ReactNode } from "react";
import type { ContentPluginLocale, ContentResourcePresentation, ContentTypeDefinition } from "@cognelo/content-type-sdk";
import "@cognelo/plugin-registry/content";
import { FileContentSettingsForm } from "@cognelo/plugin-file-content";
import { GithubRepoSettingsForm } from "@cognelo/plugin-github-repo";
import { TextContentEditor, TextContentViewer, getTextContentPresentation, TextContentSettingsForm } from "@cognelo/plugin-text-content";
import { getLinkContentPresentation, LinkContentSettingsForm } from "@cognelo/plugin-link-content";
import { api, type CourseContentItem, type CourseContentResource } from "./api";
export { ContentTypeIcon } from "../components/app-icon";

export type ContentTypeSettingsState = {
  title: string;
  url: string;
  body: string;
  metadata: Record<string, unknown>;
  isVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
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
  editor?: { isVisible: boolean; onSave: (payload: Record<string, unknown>, visible: boolean) => Promise<void> };
  t: (key: string, params?: Record<string, string | number>) => string;
};

export type ContentTypeRenderer = (context: ContentTypeRendererContext) => ReactNode;

const contentTypeRenderers: Record<string, ContentTypeRenderer> = {
  "text-content-viewer": ({ resource }) => resource ? <TextContentViewer metadata={resource.metadata ?? {}} /> : null
};
const contentTypeEditors: Record<string, ContentTypeRenderer> = {
  "text-content-editor": ({ resource, locale, editor }) => resource && editor ? <TextContentEditor title={resource.title} metadata={resource.metadata ?? {}} locale={locale} isVisible={editor.isVisible} onSave={editor.onSave} /> : null
};
export function resolveContentTypeEditor(key?: string) { return key ? contentTypeEditors[key] ?? null : null; }
export function contentResourceEditorHref(resource: CourseContentResource) { return `/courses/${resource.courseId}/materials/${resource.id}/edit`; }

const contentTypeSettingsRenderers: Record<string, ContentTypeRenderer> = {
  "link-content-settings": (context) => context.settings && context.resource ? <LinkContentSettingsForm
    resourceId={context.resource.id}
    title={context.settings.title}
    url={context.settings.url}
    metadata={context.settings.metadata}
    locale={context.locale}
    error={context.settings.error}
    onTitleChange={context.settings.onTitleChange}
    onUrlChange={context.settings.onUrlChange}
    onMetadataChange={context.settings.onMetadataChange}
    onSubmit={context.settings.onSubmit}
    loadInternalSettings={async () => (await api.contentResourcePluginRequest<{ settings: { internalSummary: string; maxWords: number } }>(context.resource!, ["summary"])).settings}
    generateInternalSummary={(url, maxWords) => api.contentResourcePluginRequest<{ summary: string; wordCount: number; maxWords: number }>(context.resource!, ["summary"], { method: "POST", payload: { url, maxWords } })}
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
        metadata={context.settings.metadata}
        locale={context.locale}
        isVisible={context.settings.isVisible ?? true}
        onVisibilityChange={context.settings.onVisibilityChange ?? (() => {})}
        onMetadataChange={context.settings.onMetadataChange}
        editorHref={context.resource ? contentResourceEditorHref(context.resource) : undefined}
        error={context.settings.error}
        onSubmit={context.settings.onSubmit}
      />
    ) : null
};

const contentPresentations: Record<string, (resource: CourseContentResource) => ContentResourcePresentation> = {
  "text-content-presentation": (resource) => getTextContentPresentation(resource.metadata),
  "link-content-presentation": (resource) => getLinkContentPresentation(resource.metadata)
};

export function resolveContentResourcePresentation(definition: ContentTypeDefinition | null | undefined, resource: CourseContentResource | null | undefined, context: { groupId?: string; preview?: boolean } = {}) {
  const presentation = resource && definition?.presentationRendererKey ? contentPresentations[definition.presentationRendererKey]?.(resource) ?? null : null;
  if (resource && presentation?.displayMode === "page") {
    const params = new URLSearchParams();
    const groupId = context.groupId ?? resource.groupId;
    if (groupId) params.set("groupId", groupId);
    if (context.preview) params.set("preview", "1");
    return { ...presentation, href: `/courses/${resource.courseId}/materials/${resource.id}${params.size ? `?${params}` : ""}` };
  }
  return presentation;
}

export function resolveContentTypeRenderer(rendererKey: string | null | undefined) {
  return rendererKey ? contentTypeRenderers[rendererKey] ?? null : null;
}

export function resolveContentTypeSettingsRenderer(rendererKey: string | null | undefined) {
  return rendererKey ? contentTypeSettingsRenderers[rendererKey] ?? null : null;
}
