"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityTypeIcon, FolderContentIcon } from "@/components/app-icon";
import { StudentPreviewBanner } from "@/components/student-preview-banner";
import { api, type ActivityDefinition, type CourseContentItem, type CourseContentResource, type StudentPreviewWorkspace } from "@/lib/api";
import { clearStudentPreviewSession } from "@/lib/student-preview-state-host";
import { useI18n } from "@/lib/i18n";

export default function StudentViewPage() {
  const { courseId, groupId } = useParams<{ courseId: string; groupId: string }>();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const [workspace, setWorkspace] = useState<StudentPreviewWorkspace | null>(null);
  const [definitions, setDefinitions] = useState<ActivityDefinition[]>([]);
  const [resources, setResources] = useState<CourseContentResource[]>([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(() => searchParams.get("previewSession") || crypto.randomUUID());

  useEffect(() => {
    window.history.replaceState({}, "", studentViewUrl(courseId, groupId, sessionId));
  }, [courseId, groupId, sessionId]);

  useEffect(() => {
    Promise.all([
      api.studentPreviewWorkspace(courseId, groupId),
      api.activityTypes(),
      api.groupContentResources(courseId, groupId)
    ]).then(([workspaceResult, typeResult, resourceResult]) => {
      setWorkspace(workspaceResult.workspace);
      setDefinitions(typeResult.registeredDefinitions);
      setResources(resourceResult.resources);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : t("studentView.loadError")));
  }, [courseId, groupId, t]);

  const rows = useMemo(() => flattenContent(workspace?.contentItems ?? []), [workspace?.contentItems]);
  const activityByAssignment = useMemo(() => new Map(
    (workspace?.group.activities ?? []).map((assignment) => [assignment.id, assignment])
  ), [workspace?.group.activities]);
  const resourceById = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);
  const courseMaterialById = useMemo(() => new Map((workspace?.course.materials ?? []).map((material) => [material.id, material])), [workspace?.course.materials]);
  const groupMaterialById = useMemo(() => new Map((workspace?.group.materials ?? []).map((material) => [material.id, material])), [workspace?.group.materials]);

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
            <section className="hero-panel hero-panel-compact">
              <div className="hero-meta">
                <p className="eyebrow">{workspace.group.title}</p>
                <h1>{workspace.course.title}</h1>
                {workspace.course.description ? <MarkdownRenderer markdown={workspace.course.description} className="muted" compact /> : null}
              </div>
            </section>
            {!workspace.isAvailable ? (
              <section className="section stack">
                <h2>{t("studentView.groupUnavailableTitle")}</h2>
                <p className="muted">{t("studentView.groupUnavailableText")}</p>
              </section>
            ) : (
              <section className="section stack">
                <div><p className="eyebrow">{t("courseDetail.contentEyebrow")}</p><h2>{t("courseDetail.contentTab")}</h2></div>
                {rows.length ? (
                  <div className="table-list">
                    {rows.map(({ item, depth }) => {
                      const assignment = item.courseGroupActivityId ? activityByAssignment.get(item.courseGroupActivityId) : null;
                      const activity = assignment?.activity;
                      const definition = activity ? definitions.find((candidate) => candidate.key === activity.activityType.key) : null;
                      const title = item.titleSnapshot || activity?.title || t("courseDetail.untitledFolder");
                      const resource = item.contentResourceId ? resourceById.get(item.contentResourceId) : null;
                      const courseMaterial = item.materialId ? courseMaterialById.get(item.materialId) : null;
                      const groupMaterial = item.materialId ? groupMaterialById.get(item.materialId) : null;
                      const href = activity
                        ? `/courses/${courseId}/groups/${groupId}/student-view/activities/${activity.id}?previewSession=${encodeURIComponent(sessionId)}`
                        : resourceHref(courseId, groupId, resource)
                          ?? (courseMaterial ? api.groupCourseMaterialDownloadUrl(courseId, groupId, courseMaterial.id) : null)
                          ?? (groupMaterial ? api.groupMaterialDownloadUrl(courseId, groupId, groupMaterial.id) : null);
                      return (
                        <div className={`table-row table-row-content-tree is-student-content ${item.kind === "folder" ? "is-folder-row" : ""}`} key={item.id} style={{ paddingLeft: 14 + depth * 20 }}>
                          <div className="table-main table-main-stack">
                            <span className="content-item-icon">
                              {item.kind === "folder" ? <FolderContentIcon collapsed={false} /> : item.kind === "activity" ? <ActivityTypeIcon iconName={definition?.icon ?? "placeholder"} /> : null}
                            </span>
                            <strong>{href ? resource || courseMaterial || groupMaterial ? <a href={href} rel="noreferrer" target="_blank">{title}</a> : <Link href={href}>{title}</Link> : title}</strong>
                            {activity ? <span className="metadata-badge is-activity-type">{definition?.i18n?.[locale]?.name ?? definition?.name ?? activity.activityType.name}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="muted">{t("courseDetail.noContentItems")}</p>}
              </section>
            )}
          </>
        ) : error ? <p className="error">{error}</p> : <p>{t("common.loading")}</p>}
      </main>
    </AppShell>
  );
}

function flattenContent(items: CourseContentItem[]) {
  const byParent = new Map<string | null, CourseContentItem[]>();
  items.forEach((item) => {
    const parent = item.parentId ?? null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  });
  byParent.forEach((children) => children.sort((left, right) => left.position - right.position));
  const result: Array<{ item: CourseContentItem; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => (byParent.get(parentId) ?? []).forEach((item) => {
    result.push({ item, depth });
    visit(item.id, depth + 1);
  });
  visit(null, 0);
  return result;
}

function resourceHref(courseId: string, groupId: string, resource?: CourseContentResource | null) {
  if (!resource) return null;
  if (typeof resource.metadata?.storedName === "string") return api.groupContentResourceDownloadUrl(courseId, groupId, resource.id);
  return typeof resource.metadata?.url === "string" ? resource.metadata.url : null;
}

function studentViewUrl(courseId: string, groupId: string, sessionId: string) {
  return `/courses/${courseId}/groups/${groupId}/student-view?previewSession=${encodeURIComponent(sessionId)}`;
}
