"use client";

import type { ContentTypeDefinition } from "@cognelo/content-type-sdk";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StudentCourseContent } from "@/components/student-course-content";
import { StudentPreviewBanner } from "@/components/student-preview-banner";
import {
  api,
  type ActivityDefinition,
  type ActivityType,
  type CourseContentResource,
  type StudentPreviewWorkspace
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { clearStudentPreviewSession } from "@/lib/student-preview-state-host";
import { useStudentCourseLocation } from "@/lib/use-student-course-location";

export default function StudentViewPage() {
  const { courseId, groupId } = useParams<{ courseId: string; groupId: string }>();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const [workspace, setWorkspace] = useState<StudentPreviewWorkspace | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [contentTypeDefinitions, setContentTypeDefinitions] = useState<ContentTypeDefinition[]>([]);
  const [resources, setResources] = useState<CourseContentResource[]>([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(() => searchParams.get("previewSession") || crypto.randomUUID());
  const loadError = t("studentView.loadError");
  const location = useStudentCourseLocation({ courseId, groupId, scope: "preview",
    requestedFolderId: searchParams.get("folder"), active: Boolean(workspace?.isAvailable), ready: Boolean(workspace) });

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.set("previewSession", sessionId);
    window.history.replaceState(null, "", `/courses/${courseId}/groups/${groupId}/student-view?${query}`);
  }, [courseId, groupId, sessionId]);

  useEffect(() => {
    let isActive = true;
    setError("");
    Promise.all([
      api.studentPreviewWorkspace(courseId, groupId),
      api.activityTypes(),
      api.courseContentTypes(courseId),
      api.groupContentResources(courseId, groupId)
    ]).then(([workspaceResult, activityTypeResult, contentTypeResult, resourceResult]) => {
      if (!isActive) return;
      setWorkspace(workspaceResult.workspace);
      setActivityTypes(activityTypeResult.activityTypes);
      setActivityDefinitions(activityTypeResult.registeredDefinitions);
      setContentTypeDefinitions(contentTypeResult.activeContentTypes ?? contentTypeResult.contentTypes);
      setResources(resourceResult.resources);
    }).catch((reason) => {
      if (isActive) setError(reason instanceof Error ? reason.message : loadError);
    });
    return () => {
      isActive = false;
    };
  }, [courseId, groupId, loadError]);

  function resetPreview() {
    clearStudentPreviewSession(courseId, groupId, sessionId);
    setSessionId(crypto.randomUUID());
  }

  return (
    <AppShell>
      <main className="page stack">
        <StudentPreviewBanner groupTitle={workspace?.group.title} onReset={resetPreview} t={t} />
        {workspace ? (
          <>
            {!workspace.isAvailable ? (
              <section className="section stack">
                <h2>{t("studentView.groupUnavailableTitle")}</h2>
                <p className="muted">{t("studentView.groupUnavailableText")}</p>
              </section>
            ) : (
              <section className="section stack">
                <div>
                  <h1 className="content-title">{workspace.course.subject?.title ?? `${workspace.course.title}: ${workspace.group.title}`}</h1>
                  {workspace.course.subject ? <p className="muted">{workspace.course.title}: {workspace.group.title}</p> : null}
                </div>
                <StudentCourseContent
                  activityDefinitions={activityDefinitions}
                  activityHref={(activityId) => `/courses/${courseId}/groups/${groupId}/student-view/activities/${activityId}?previewSession=${encodeURIComponent(sessionId)}`}
                  onActivityOpen={location.rememberPosition}
                  activityTypes={activityTypes}
                  assignments={workspace.group.activities ?? []}
                  contentItems={workspace.contentItems}
                  contentResources={resources}
                  contentTypeDefinitions={contentTypeDefinitions}
                  courseId={courseId}
                  courseMaterials={workspace.course.materials ?? []}
                  courseMetadata={workspace.course.metadata}
                  folderHref={(folderId) => `${studentViewUrl(courseId, groupId, sessionId)}&folder=${encodeURIComponent(folderId)}`}
                  groupId={groupId}
                  groupMaterials={workspace.group.materials ?? []}
                  locale={locale}
                  selectedFolderId={location.folderId}
                  storageScope="preview"
                  t={t}
                />
              </section>
            )}
          </>
        ) : error ? <p className="error">{error}</p> : <p>{t("common.loading")}</p>}
      </main>
    </AppShell>
  );
}

function studentViewUrl(courseId: string, groupId: string, sessionId: string) {
  return `/courses/${courseId}/groups/${groupId}/student-view?previewSession=${encodeURIComponent(sessionId)}`;
}
