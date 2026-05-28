import React, { type ReactNode } from "react";
import type { ContentPluginLocale, ContentTypeDefinition, ContentTypeIconName } from "@cognelo/content-type-sdk";
import { FileContentSettingsForm } from "@cognelo/plugin-file-content";
import { GithubRepoSettingsForm } from "@cognelo/plugin-github-repo";
import { TextContentSettingsForm } from "@cognelo/plugin-text-content";
import type { CourseContentItem, CourseContentResource } from "./api";

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

export function ContentTypeIcon({ iconName }: { iconName: ContentTypeIconName }) {
  const paths: Record<ContentTypeIconName, ReactNode> = {
    document: (
      <>
        <path d="M10 4h8l5 5v19H10z" />
        <path d="M18 4v6h5" />
        <path d="M13 16h7" />
        <path d="M13 21h7" />
      </>
    ),
    file: (
      <>
        <path d="M10 4h8l5 5v19H10z" />
        <path d="M18 4v6h5" />
        <path d="M13 16h7" />
        <path d="M13 21h7" />
      </>
    ),
    github: (
      <>
        <path d="M16 25c-6 0-11-4.8-11-10.8 0-2.4.8-4.7 2.3-6.5-.2-.9-.4-2.9.5-5 0 0 1.9-.6 5 1.9A16.8 16.8 0 0 1 16 4.3c1.1 0 2.2.1 3.2.3 3.1-2.5 5-1.9 5-1.9.9 2.1.7 4.1.5 5A10 10 0 0 1 27 14.2C27 20.2 22 25 16 25Z" />
        <path d="M12.5 24.2c-.5.9-.7 1.9-.7 3.1" />
        <path d="M19.5 24.2c.5.9.7 1.9.7 3.1" />
        <path d="M13 17.5h.01" />
        <path d="M19 17.5h.01" />
      </>
    ),
    link: (
      <>
        <path d="M13 9l2-2a5 5 0 0 1 7 7l-2 2" />
        <path d="M19 13l-6 6" />
        <path d="M11 23l-2 2a5 5 0 0 1-7-7l2-2" />
      </>
    ),
    placeholder: (
      <>
        <rect height="18" rx="3" width="18" x="7" y="7" />
        <path d="M12 12h8v8h-8z" />
      </>
    ),
    text: (
      <>
        <path d="M7 6h18" />
        <path d="M16 6v20" />
        <path d="M11 26h10" />
        <path d="M9 12h14" />
      </>
    )
  };

  return (
    <span className="activity-type-icon" aria-hidden="true">
      <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 32 32" width="28">
        {paths[iconName] ?? paths.file}
      </svg>
    </span>
  );
}
