"use client";

import { AppIcon } from "@/components/app-icon";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { ContentTypeDefinition } from "@cognelo/content-type-sdk";
import { AppShell } from "./app-shell";
import { ContentResourceBody } from "./content-resource-display";
import { api, type CourseContentResource, type CourseContentItem } from "@/lib/api";
import { resolveContentTypeEditor } from "@/lib/content-type-renderers";
import { useI18n } from "@/lib/i18n";

export function ContentResourcePage({ editing = false }: { editing?: boolean }) {
  return <Suspense><ResourcePage editing={editing} /></Suspense>;
}
function ResourcePage({ editing }: { editing: boolean }) {
  const { courseId, resourceId } = useParams<{ courseId: string; resourceId: string }>();
  const params = useSearchParams();
  const groupId = editing ? undefined : params.get("groupId") || undefined;
  const { locale, t } = useI18n();
  const [data, setData] = useState<{ resource: CourseContentResource; contentItem: CourseContentItem | null; definition: ContentTypeDefinition; canManage: boolean } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setData(null); setError("");
    Promise.all([api.contentResourcePage(courseId, resourceId, groupId), api.courseContentTypes(courseId)]).then(([result, types]) => {
      if (cancelled) return;
      const definition = (types.activeContentTypes ?? types.contentTypes).find((item) => item.key === result.resource.contentTypeKey);
      if (!definition || (editing && !result.canManage)) throw new Error(t("courseDetail.contentSettingsUnavailable"));
      setData({ ...result, definition });
    }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [courseId, resourceId, groupId, editing, t]);
  const back = groupId ? `/courses/${courseId}/groups/${groupId}${params.get("preview") === "1" ? "/student-view" : ""}?tab=content` : `/courses/${courseId}?tab=content`;
  const editor = resolveContentTypeEditor(data?.definition.editorRendererKey);
  return <AppShell><div className="stack">
    <div className="row activity-editor-context">
      <Link className="button secondary" href={back}><AppIcon name="back" /> {t("groupPage.backToCourse")}</Link>
    </div>
    {error ? <p className="error" role="alert">{error}</p> : !data ? <p>{t("common.loading")}</p> : <section className="card stack text-material-page">
      <h1 className="section-title">{data.resource.title}</h1>
      {editing ? editor?.({ definition: data.definition, resource: data.resource, locale, t, editor: {
        isVisible: data.contentItem?.isVisible ?? true,
        onSave: async (payload, isVisible) => {
          const { resource } = await api.updateCourseContentResource(courseId, resourceId, { payload, isVisible });
          setData((current) => current ? { ...current, resource, contentItem: current.contentItem ? { ...current.contentItem, isVisible } : null } : current);
        }
      } }) : <ContentResourceBody resource={data.resource} definition={data.definition} />}
    </section>}
  </div></AppShell>;
}
