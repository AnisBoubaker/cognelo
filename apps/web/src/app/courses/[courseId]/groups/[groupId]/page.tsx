"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import type { ContentTypeDefinition } from "@cognelo/content-type-sdk";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CSSProperties, FocusEvent, FormEvent, PointerEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import {
  api,
  ActivityDefinition,
  ActivityType,
  Course,
  CourseGradebook,
  CourseGradebookItemSummary,
  CourseGradebookRow,
  CourseGroup,
  CourseGroupMaterial,
  CourseContentItem,
  CourseContentResource,
  CourseMaterial,
  GradebookStatus,
  GroupParticipant,
  GroupParticipantCandidate,
  StudentGradeFeedback,
  StudentReleasedGrades
} from "@/lib/api";
import { ContentTypeIcon as MaterialTypeIcon } from "@/lib/content-type-renderers";
import { useI18n } from "@/lib/i18n";

type ContentDropPlacement = "after" | "before" | "inside";
type ContentDropTarget = { id: string; type: "root" } | { id: string; placement: ContentDropPlacement; type: "content" };

const contentDragActivationDistance = 8;

export default function CourseGroupPage() {
  const params = useParams<{ courseId: string; groupId: string }>();
  const { courseId, groupId } = params;
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [group, setGroup] = useState<CourseGroup | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [contentTypeDefinitions, setContentTypeDefinitions] = useState<ContentTypeDefinition[]>([]);
  const [activeContentTypeDefinitions, setActiveContentTypeDefinitions] = useState<ContentTypeDefinition[]>([]);
  const [contentResources, setContentResources] = useState<CourseContentResource[]>([]);
  const [contentItems, setContentItems] = useState<CourseContentItem[]>([]);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [studentGrades, setStudentGrades] = useState<StudentReleasedGrades | null>(null);
  const [submittedActivityIds, setSubmittedActivityIds] = useState<Set<string>>(new Set());
  const [gradebookActivityId, setGradebookActivityId] = useState("");
  const [gradebookStatus, setGradebookStatus] = useState<GradebookStatus>("all");
  const [savingReleaseItemId, setSavingReleaseItemId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupStatus, setGroupStatus] = useState<"draft" | "published">("draft");
  const [groupAvailableFrom, setGroupAvailableFrom] = useState("");
  const [groupAvailableUntil, setGroupAvailableUntil] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [draggingContentItemId, setDraggingContentItemId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ title: string; x: number; y: number } | null>(null);
  const [contentDropTarget, setContentDropTarget] = useState<ContentDropTarget | null>(null);
  const [collapsedContentFolderIds, setCollapsedContentFolderIds] = useState<Set<string>>(new Set());
  const [openStudentRootFolderIds, setOpenStudentRootFolderIds] = useState<Set<string>>(new Set());
  const [studentAccordionStateLoaded, setStudentAccordionStateLoaded] = useState(false);
  const [assignActivityId, setAssignActivityId] = useState("");
  const [assignParentId, setAssignParentId] = useState("");
  const [assignIsVisible, setAssignIsVisible] = useState(true);
  const [assignAvailableFrom, setAssignAvailableFrom] = useState("");
  const [assignAvailableUntil, setAssignAvailableUntil] = useState("");
  const [assignAssessmentMode, setAssignAssessmentMode] = useState<"formative" | "summative">("formative");
  const [assignPointsPossible, setAssignPointsPossible] = useState("100");
  const [assignGradingMode, setAssignGradingMode] = useState<"points" | "pass_fail">("points");
  const [assignPassThresholdPoints, setAssignPassThresholdPoints] = useState("50");
  const [assignPassThresholdOutOf, setAssignPassThresholdOutOf] = useState("100");
  const [assignAttemptLimitMode, setAssignAttemptLimitMode] = useState<"unlimited" | "max_attempts" | "until_due">("unlimited");
  const [assignMaxAttempts, setAssignMaxAttempts] = useState("1");
  const [assignGradeStrategy, setAssignGradeStrategy] = useState<"latest" | "best" | "first" | "weighted_average">("latest");
  const [assignDropLowestAttempt, setAssignDropLowestAttempt] = useState(false);
  const [isAssigningActivity, setIsAssigningActivity] = useState(false);
  const [draggingAssignmentId, setDraggingAssignmentId] = useState<string | null>(null);
  const [assignmentDropTargetId, setAssignmentDropTargetId] = useState<string | null>(null);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [participantFirstName, setParticipantFirstName] = useState("");
  const [participantLastName, setParticipantLastName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [participantExternalId, setParticipantExternalId] = useState("");
  const [participantRole, setParticipantRole] = useState<"teacher" | "ta" | "student">("student");
  const [participantCandidate, setParticipantCandidate] = useState<GroupParticipantCandidate | null>(null);
  const [checkingParticipantEmail, setCheckingParticipantEmail] = useState(false);
  const [participantError, setParticipantError] = useState("");
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [contentActionError, setContentActionError] = useState("");

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";

  async function refresh() {
    setContentLoaded(false);
    const [courseResult, groupResult, typeResult] = await Promise.all([
      api.course(courseId),
      api.group(courseId, groupId),
      api.activityTypes()
    ]);
    setCourse(courseResult.course);
    setGroup(groupResult.group);
    setGroupTitle(groupResult.group.title);
    setGroupStatus(groupResult.group.status);
    setGroupAvailableFrom(toDateTimeLocalValue(groupResult.group.availableFrom));
    setGroupAvailableUntil(toDateTimeLocalValue(groupResult.group.availableUntil));
    setActivityTypes(typeResult.activityTypes);
    setActivityDefinitions(typeResult.registeredDefinitions);
    const role = courseResult.course.memberships?.find((membership) => membership.userId === user?.id)?.role;
    const userCanManage = user?.roles.includes("admin") || role === "owner" || role === "teacher";
    const [contentResult, contentTypesResult, contentResourcesResult] = await Promise.all([
      api.groupContent(courseId, groupId, { visibleOnly: !userCanManage }),
      api.courseContentTypes(courseId),
      api.groupContentResources(courseId, groupId)
    ]);
    setContentItems(contentResult.contentItems);
    setContentTypeDefinitions(contentTypesResult.contentTypes);
    setActiveContentTypeDefinitions(contentTypesResult.activeContentTypes ?? contentTypesResult.contentTypes);
    setContentResources(contentResourcesResult.resources);
    setContentLoaded(true);
    if (userCanManage) {
      const gradebookResult = await api.courseGradebook(courseId, {
        groupId,
        activityId: gradebookActivityId || undefined,
        status: gradebookStatus
      });
      setGradebook(gradebookResult.gradebook);
      setStudentGrades(null);
    } else {
      setGradebook(null);
      const [gradesResult, submissionAudits] = await Promise.all([
        api.studentGroupGrades(courseId, groupId),
        Promise.all(
          (groupResult.group.activities ?? []).map(async (assignment) => ({
            activityId: assignment.activity.id,
            audit: await api.studentActivitySubmissions(courseId, groupId, assignment.activity.id)
          }))
        )
      ]);
      setStudentGrades(gradesResult.grades);
      setSubmittedActivityIds(
        new Set(
          submissionAudits
            .filter((entry) => entry.audit.audit.submittedAttemptCount > 0)
            .map((entry) => entry.activityId)
        )
      );
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("groupPage.loadError")));
  }, [courseId, groupId, t, user, gradebookActivityId, gradebookStatus]);

  async function setGradebookRelease(gradebookItemId: string, released: boolean, activityTitle: string) {
    const confirmed = window.confirm(
      t(released ? "courseDetail.releaseGradesConfirm" : "courseDetail.hideGradesConfirm", { title: activityTitle })
    );
    if (!confirmed) {
      return;
    }

    setSavingReleaseItemId(gradebookItemId);
    setError("");
    try {
      await api.setGradebookItemRelease(courseId, gradebookItemId, { released });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.gradeReleaseError"));
    } finally {
      setSavingReleaseItemId(null);
    }
  }

  const materials = group?.materials ?? [];
  const courseMaterials = course?.materials ?? [];
  const assignedActivities = group?.activities ?? [];
  const contentFolderOptions = flattenContentItems(contentItems, new Set())
    .filter(({ item }) => item.kind === "folder")
    .map(({ item, depth }) => ({ item, depth }));
  const visibleContentItems = flattenContentItems(contentItems, collapsedContentFolderIds);
  const studentContentItems = contentItems.filter((item) => item.kind !== "activity" || Boolean(item.courseGroupActivityId));
  const studentRootContentItems = studentContentItems.filter((item) => !item.parentId).sort(compareContentItems);
  const studentRootFolderIds = studentRootContentItems.filter((item) => item.kind === "folder").map((item) => item.id);
  const studentRootFolderIdSignature = studentRootFolderIds.join("|");
  const studentAccordionStorageKey = `cognelo:course:${courseId}:group:${groupId}:student-content-accordion`;
  const studentContentReady = Boolean(course && group && contentLoaded);
  const courseMaterialById = new Map(courseMaterials.map((material) => [material.id, material]));
  const groupMaterialById = new Map(materials.map((material) => [material.id, material]));
  const contentResourceById = new Map(contentResources.map((resource) => [resource.id, resource]));
  const contentTypeByKey = new Map(activeContentTypeDefinitions.map((definition) => [definition.key, definition]));
  const courseActivityById = new Map((course?.activities ?? []).map((activity) => [activity.id, activity]));
  const assignmentById = new Map(assignedActivities.map((assignment) => [assignment.id, assignment]));
  const releasedGradeByActivityId = new Map(
    (studentGrades?.rows ?? [])
      .filter((row) => row.score !== null)
      .map((row) => [row.activityId, row])
  );
  const participants = group?.participants ?? [];
  const assignableActivities = (course?.activities ?? []).filter(
    (activity) => !assignedActivities.some((assignment) => assignment.activityId === activity.id)
  );
  const selectedAssignableActivity = assignableActivities.find((activity) => activity.id === assignActivityId);
  const assignActivityIsTest = selectedAssignableActivity?.activityType.key === "test";
  const effectiveAssignAssessmentMode = assignActivityIsTest ? "summative" : assignAssessmentMode;
  const gradebookActivities = buildGroupGradebookActivitySummaries(gradebook?.items ?? [], gradebook?.rows ?? []);
  const gradebookOverview = buildGroupGradebookOverview(gradebookActivities);
  const now = Date.now();

  useEffect(() => {
    if (!assignActivityId && assignableActivities[0]?.id) {
      setAssignActivityId(assignableActivities[0].id);
    }
  }, [assignActivityId, assignableActivities]);

  useEffect(() => {
    setStudentAccordionStateLoaded(false);
    try {
      const storedValue = window.localStorage.getItem(studentAccordionStorageKey);
      const parsedValue = storedValue ? JSON.parse(storedValue) : [];
      setOpenStudentRootFolderIds(new Set(Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === "string") : []));
    } catch {
      setOpenStudentRootFolderIds(new Set());
    } finally {
      setStudentAccordionStateLoaded(true);
    }
  }, [studentAccordionStorageKey]);

  useEffect(() => {
    if (!studentAccordionStateLoaded || !studentContentReady) {
      return;
    }
    const validFolderIds = new Set(studentRootFolderIds);
    setOpenStudentRootFolderIds((current) => {
      const next = new Set([...current].filter((folderId) => validFolderIds.has(folderId)));
      return setsAreEqual(current, next) ? current : next;
    });
  }, [studentAccordionStateLoaded, studentContentReady, studentRootFolderIdSignature]);

  useEffect(() => {
    if (!studentAccordionStateLoaded || !studentContentReady) {
      return;
    }
    try {
      window.localStorage.setItem(studentAccordionStorageKey, JSON.stringify([...openStudentRootFolderIds]));
    } catch {
      // Ignore localStorage failures; the accordion still works for the current session.
    }
  }, [openStudentRootFolderIds, studentAccordionStateLoaded, studentAccordionStorageKey, studentContentReady]);

  function renderStudentContentRow(item: CourseContentItem, depth: number, options: { isRootAccordionFolder?: boolean } = {}) {
    const title = contentItemTitle(item);
    const href = contentItemHref(item);
    const isRootAccordionFolder = Boolean(options.isRootAccordionFolder);
    const isCollapsed = isRootAccordionFolder ? !openStudentRootFolderIds.has(item.id) : collapsedContentFolderIds.has(item.id);
    const material = item.materialId ? courseMaterialById.get(item.materialId) ?? groupMaterialById.get(item.materialId) : null;
    const materialIsDownloadable = material ? legacyMaterialHasStoredFile(material) : false;
    const contentResource = item.contentResourceId ? contentResourceById.get(item.contentResourceId) : null;
    const contentResourceIsFile = contentResource
      ? contentTypeByKey.get(contentResource.contentTypeKey)?.embeddingSource === "file_upload"
      : false;
    const assignment = item.courseGroupActivityId ? assignmentById.get(item.courseGroupActivityId) : null;
    const courseActivity = item.activityId ? courseActivityById.get(item.activityId) : null;
    const activityTypeKey = assignment?.activity.activityType.key ?? courseActivity?.activityType.key ?? null;
    const activityLabel = activityTypeKey ? activityCopy(activityTypeKey).name : null;
    const releasedGrade = assignment ? releasedGradeByActivityId.get(assignment.activity.id) : null;
    const isSubmitted = assignment ? submittedActivityIds.has(assignment.activity.id) : false;
    const availability = assignment ? getAvailabilityStatus(assignment.availableFrom, assignment.availableUntil, now) : "available";
    const isOpenable = availability !== "upcoming";
    const hasBadges = Boolean(activityLabel || assignment || availability !== "available" || isSubmitted || releasedGrade);
    const studentRowIndent = Math.max(0, depth - 1) * 28;

    return (
      <div
        className={`table-row table-row-content-tree is-student-content ${item.kind === "folder" ? "is-folder-row" : ""} ${
          isRootAccordionFolder ? `is-student-accordion-root ${isCollapsed ? "" : "is-open"}` : ""
        } ${isOpenable ? "" : "is-content-locked"}`}
        key={item.id}
        style={
          isRootAccordionFolder
            ? undefined
            : ({
                "--content-tree-indent": `${14 + Math.min(depth, 1) * 20}px`,
                "--student-content-row-indent": `${studentRowIndent}px`,
                paddingLeft: 14 + Math.min(depth, 1) * 20
              } as CSSProperties)
        }
      >
        <div className="table-main table-main-stack">
          {isRootAccordionFolder ? null : <span className="content-tree-student-spacer" aria-hidden="true" />}
          {item.kind === "folder" && !isRootAccordionFolder ? (
            <button
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? t("courseDetail.expandFolder", { title }) : t("courseDetail.collapseFolder", { title })}
              className="content-item-icon-button"
              title={isCollapsed ? t("courseDetail.expandFolderTitle") : t("courseDetail.collapseFolderTitle")}
              type="button"
              onClick={() => {
                if (isRootAccordionFolder) {
                  setOpenStudentRootFolderIds((current) => toggleSetValue(current, item.id));
                  return;
                }
                toggleContentFolder(item.id);
              }}
            >
              <FolderContentIcon collapsed={isCollapsed} />
            </button>
          ) : item.kind !== "folder" ? (
            <span className="content-item-icon">
              {item.kind === "activity" ? <ActivityContentIcon /> : <MaterialTypeIcon iconName={contentItemMaterialIconName(item)} />}
            </span>
          ) : null}
          <strong>
            {isRootAccordionFolder ? (
              <button
                aria-expanded={!isCollapsed}
                className="student-accordion-title-button"
                type="button"
                onClick={() => setOpenStudentRootFolderIds((current) => toggleSetValue(current, item.id))}
              >
                {title}
              </button>
            ) : href && isOpenable && material ? (
              <a
                href={href}
                rel={materialIsDownloadable ? undefined : "noreferrer"}
                target={materialIsDownloadable ? undefined : "_blank"}
              >
                {title}
              </a>
            ) : href && isOpenable && contentResource ? (
              <a href={href} rel={contentResourceIsFile ? undefined : "noreferrer"} target={contentResourceIsFile ? undefined : "_blank"}>
                {title}
              </a>
            ) : href && isOpenable ? (
              <Link href={href}>{title}</Link>
            ) : (
              title
            )}
          </strong>
          {hasBadges ? (
            <span className="metadata-badges">
              {activityLabel ? <span className="metadata-badge is-activity-type">{activityLabel}</span> : null}
              {assignment ? <span className="metadata-badge">{formatAvailabilityWindow(assignment.availableFrom, assignment.availableUntil, t)}</span> : null}
              {availability === "upcoming" ? <span className="participant-status is-missing">{t("groupPage.activityUpcoming")}</span> : null}
              {availability === "expired" ? <span className="participant-status is-late">{t("groupPage.activityExpired")}</span> : null}
              {isSubmitted ? <span className="participant-status is-submitted">{t("courseDetail.gradebookStatus.submitted")}</span> : null}
              {releasedGrade ? (
                <span className={`participant-status is-${releasedGrade.status.replace("_", "-")}`}>
                  {t(releasedGrade.gradeKind === "final" ? "groupPage.finalGradeLabel" : "groupPage.latestGradeLabel")}:{" "}
                  {formatGradebookScore(releasedGrade.score, releasedGrade.maxScore)}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        {isRootAccordionFolder ? null : <div className="table-actions">
          {href && isOpenable ? (
            material ? (
              <a
                aria-label={t(materialIsDownloadable ? "courseDetail.downloadMaterial" : "courseDetail.openMaterial", { title })}
                className="button secondary icon-button"
                href={href}
                rel={materialIsDownloadable ? undefined : "noreferrer"}
                target={materialIsDownloadable ? undefined : "_blank"}
                title={t(materialIsDownloadable ? "common.download" : "common.open")}
              >
                <MaterialActionIcon name={materialIsDownloadable ? "download" : "open"} />
              </a>
            ) : contentResource ? (
              <a
                aria-label={t(contentResourceIsFile ? "courseDetail.downloadMaterial" : "courseDetail.openMaterial", { title })}
                className="button secondary icon-button"
                href={href}
                rel={contentResourceIsFile ? undefined : "noreferrer"}
                target={contentResourceIsFile ? undefined : "_blank"}
                title={t(contentResourceIsFile ? "common.download" : "common.open")}
              >
                <MaterialActionIcon name={contentResourceIsFile ? "download" : "open"} />
              </a>
            ) : (
              <Link aria-label={t("courseDetail.openContentItem", { title })} className="button secondary icon-button" href={href} title={t("common.open")}>
                <MaterialActionIcon name="open" />
              </Link>
            )
          ) : null}
        </div>}
      </div>
    );
  }

  if (group && course && !canManage) {
    return (
      <AppShell>
        <main className="page stack">
          <section className="hero-panel hero-panel-compact">
            <div className="hero-meta">
              <p className="eyebrow">
                {t("groupPage.eyebrow")} · {group.status === "published" ? t("groupPage.statusPublished") : t("groupPage.statusDraft")}
              </p>
              <h1>
                {course.title}: {group.title}
              </h1>
              {group.availableFrom || group.availableUntil ? (
                <p className="muted">{formatAvailabilityWindow(group.availableFrom, group.availableUntil, t)}</p>
              ) : null}
            </div>
          </section>

          {error ? <p className="error">{error}</p> : null}

          <WorkspaceTabs
            ariaLabel={t("groupPage.workspaceTabs")}
            initialTab={searchParams.get("tab") === "grades" ? "grades" : "content"}
            tabs={[
              {
                id: "content",
                label: t("courseDetail.contentTab"),
                render: () => (
                  <section className="section stack">
                    <div>
                      <h2>{t("courseDetail.contentEyebrow")}</h2>
                    </div>

                    {studentRootContentItems.length ? (
                      <div className="table-list">
                        {studentRootContentItems.map((item) => {
                          if (item.kind !== "folder") {
                            return renderStudentContentRow(item, 0);
                          }

                          const childRows =
                            openStudentRootFolderIds.has(item.id)
                              ? flattenContentItemsFromParent(studentContentItems, item.id, collapsedContentFolderIds, 1)
                              : [];

                          return (
                            <div className={`student-accordion-section ${openStudentRootFolderIds.has(item.id) ? "is-open" : ""}`} key={item.id}>
                              {renderStudentContentRow(item, 0, { isRootAccordionFolder: true })}
                              {childRows.length ? (
                                <div className="student-accordion-panel">
                                  {childRows.map(({ item: child, depth }) => renderStudentContentRow(child, depth))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">{t("courseDetail.noContentItems")}</p>
                    )}
                  </section>
                )
              },
              {
                id: "grades",
                label: t("groupPage.gradesTab"),
                render: () => (
                  <section className="section stack">
                    <div>
                      <p className="eyebrow">{t("groupPage.gradesEyebrow")}</p>
                      <h2>{t("groupPage.gradesTitle")}</h2>
                    </div>

                    {studentGrades?.rows.length ? (
                      <div className="table-list">
                        <div className="table-row table-row-student-grades table-head" aria-hidden="true">
                          <span>{t("courseDetail.activityHeader")}</span>
                          <span>{t("courseDetail.gradeHeader")}</span>
                          <span>{t("courseDetail.statusHeader")}</span>
                        </div>
                        {studentGrades.rows.map((row) => (
                          <div className="table-row table-row-student-grades" key={row.gradebookItemId}>
                            <div className="table-main table-main-stack">
                              <strong>{row.activityTitle}</strong>
                              <span className="table-meta-note muted">{row.activityTypeName}</span>
                            </div>
                            <div className="table-main table-main-stack">
                              <strong>{formatGradebookScore(row.score, row.maxScore)}</strong>
                              {row.latePenaltyApplied && row.latePenaltyPercent !== null ? (
                                <span className="table-meta-note muted">-{row.latePenaltyPercent}%</span>
                              ) : null}
                              <StudentFeedback feedback={row.feedback} maxScore={row.maxScore} t={t} />
                            </div>
                            <span className={`participant-status is-${row.status.replace("_", "-")}`}>
                              {t(`courseDetail.gradebookStatus.${row.status}`)}
                              {row.latePenaltyApplied && row.latePenaltyPercent !== null ? ` -${row.latePenaltyPercent}%` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">{t("groupPage.noReleasedGrades")}</p>
                    )}
                  </section>
                )
              }
            ]}
          />
        </main>
      </AppShell>
    );
  }

  function activityCopy(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    const localized = definition?.i18n?.[locale];

    return {
      name: localized?.name ?? definition?.name ?? activityTypes.find((type) => type.key === activityTypeKey)?.name ?? activityTypeKey,
      description:
        localized?.description ??
        definition?.description ??
        activityTypes.find((type) => type.key === activityTypeKey)?.description ??
        ""
    };
  }

  function groupMaterialHref(material: CourseGroupMaterial) {
    if (legacyMaterialHasStoredFile(material)) {
      return withDownloadVersion(api.groupMaterialDownloadUrl(courseId, groupId, material.id), material);
    }
    return material.url ?? undefined;
  }

  function courseMaterialHref(material: CourseMaterial) {
    if (legacyMaterialHasStoredFile(material)) {
      return withDownloadVersion(api.groupCourseMaterialDownloadUrl(courseId, groupId, material.id), material);
    }
    return material.url ?? undefined;
  }


  function resetParticipantForm() {
    setParticipantRole("student");
    setParticipantCandidate(null);
    setCheckingParticipantEmail(false);
    setParticipantFirstName("");
    setParticipantLastName("");
    setParticipantEmail("");
    setParticipantExternalId("");
    setParticipantError("");
  }

  function closeParticipantForm() {
    resetParticipantForm();
    setIsAddingParticipant(false);
  }

  async function saveGroupSettings(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSavingGroup(true);
    try {
      await api.updateGroup(courseId, groupId, {
        title: groupTitle,
        status: groupStatus,
        availableFrom: toIsoOrNull(groupAvailableFrom),
        availableUntil: toIsoOrNull(groupAvailableUntil)
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("groupPage.groupSaveError"));
    } finally {
      setSavingGroup(false);
    }
  }

  function buildAssignGradebookSettings() {
    const pointsPossible = Number(assignPointsPossible);
    const passThresholdPoints = Number(assignPassThresholdPoints);
    const passThresholdOutOf = Number(assignPassThresholdOutOf);
    const maxAttempts = Number(assignMaxAttempts);
    return {
      pointsPossible: Number.isFinite(pointsPossible) && pointsPossible > 0 ? pointsPossible : 100,
      gradingMode: assignGradingMode,
      passThresholdPoints:
        assignGradingMode === "pass_fail" && Number.isFinite(passThresholdPoints) ? passThresholdPoints : null,
      passThresholdOutOf:
        assignGradingMode === "pass_fail" && Number.isFinite(passThresholdOutOf) && passThresholdOutOf > 0 ? passThresholdOutOf : null,
      attemptLimitMode: assignAttemptLimitMode,
      maxAttempts: assignAttemptLimitMode === "max_attempts" && Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : null,
      gradeStrategy: assignGradeStrategy,
      dropLowestAttempt: assignGradeStrategy === "weighted_average" ? assignDropLowestAttempt : false
    };
  }

  async function assignActivity(event: FormEvent) {
    event.preventDefault();
    setAssignmentError("");

    const selectedActivity = selectedAssignableActivity;
    try {
      await api.assignGroupActivity(courseId, groupId, {
        activityId: assignActivityId,
        availableFrom: toIsoOrNull(assignAvailableFrom),
        availableUntil: toIsoOrNull(assignAvailableUntil),
        config: {},
        metadata: { assessmentMode: effectiveAssignAssessmentMode },
        ...(effectiveAssignAssessmentMode === "summative" ? { gradebookSettings: buildAssignGradebookSettings() } : {}),
        position: assignedActivities.length,
        contentPlacement: {
          parentId: assignParentId || null,
          isVisible: assignIsVisible,
          metadata: {},
          titleSnapshot: selectedActivity?.title ?? null
        }
      });
      await refresh();
      setAssignAvailableFrom("");
      setAssignAvailableUntil("");
      setAssignAssessmentMode("formative");
      setAssignPointsPossible("100");
      setAssignGradingMode("points");
      setAssignPassThresholdPoints("50");
      setAssignPassThresholdOutOf("100");
      setAssignAttemptLimitMode("unlimited");
      setAssignMaxAttempts("1");
      setAssignGradeStrategy("latest");
      setAssignDropLowestAttempt(false);
      setAssignParentId("");
      setAssignIsVisible(true);
      const remaining = assignableActivities.filter((activity) => activity.id !== assignActivityId);
      setAssignActivityId(remaining[0]?.id ?? "");
      setIsAssigningActivity(false);
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : t("groupPage.assignmentCreateError"));
    }
  }

  function contentItemTitle(item: CourseContentItem) {
    if (item.contentResourceId) {
      return contentResourceById.get(item.contentResourceId)?.title ?? item.titleSnapshot ?? t("courseDetail.untitledMaterial");
    }
    if (item.materialId) {
      return (
        courseMaterialById.get(item.materialId)?.title ??
        groupMaterialById.get(item.materialId)?.title ??
        item.titleSnapshot ??
        t("courseDetail.untitledMaterial")
      );
    }
    if (item.courseGroupActivityId) {
      return assignmentById.get(item.courseGroupActivityId)?.activity.title ?? item.titleSnapshot ?? t("courseDetail.defaultActivityTitle");
    }
    if (item.activityId) {
      return courseActivityById.get(item.activityId)?.title ?? item.titleSnapshot ?? t("courseDetail.defaultActivityTitle");
    }
    return item.titleSnapshot ?? t("courseDetail.untitledFolder");
  }

  function contentItemMaterialIconName(item: CourseContentItem) {
    if (item.contentResourceId) {
      const resource = contentResourceById.get(item.contentResourceId);
      return (resource ? contentTypeByKey.get(resource.contentTypeKey)?.icon : null) ?? "file";
    }
    return "file" as const;
  }

  function toggleContentFolder(folderId: string) {
    setCollapsedContentFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function contentItemHref(item: CourseContentItem) {
    if (item.courseGroupActivityId) {
      const assignment = assignmentById.get(item.courseGroupActivityId);
      return assignment ? `/courses/${courseId}/groups/${groupId}/activities/assigned/${assignment.activity.id}` : null;
    }
    if (item.activityId && courseActivityById.has(item.activityId)) {
      return `/courses/${courseId}/activities/${item.activityId}`;
    }
    if (item.materialId && courseMaterialById.has(item.materialId)) {
      return courseMaterialHref(courseMaterialById.get(item.materialId) as CourseMaterial) ?? null;
    }
    if (item.materialId && groupMaterialById.has(item.materialId)) {
      return groupMaterialHref(groupMaterialById.get(item.materialId) as CourseGroupMaterial) ?? null;
    }
    if (item.contentResourceId && contentResourceById.has(item.contentResourceId)) {
      const resource = contentResourceById.get(item.contentResourceId) as CourseContentResource;
      const definition = contentTypeByKey.get(resource.contentTypeKey);
      if (!definition) {
        return null;
      }
      if (definition.embeddingSource === "file_upload" && typeof resource.metadata?.storedName === "string") {
        return withDownloadVersion(api.groupContentResourceDownloadUrl(courseId, groupId, resource.id), resource);
      }
      return typeof resource.metadata?.url === "string" ? resource.metadata.url : null;
    }
    return null;
  }

  async function updateContentInScope(item: CourseContentItem, input: { parentId?: string | null; isVisible?: boolean; position?: number }) {
    if (item.groupId) {
      await api.updateGroupContentItem(courseId, groupId, item.id, input);
    } else {
      await api.updateContentItem(courseId, item.id, input);
    }
  }

  async function deleteContentInScope(item: CourseContentItem) {
    if (item.groupId) {
      await api.deleteGroupContentItem(courseId, groupId, item.id);
    } else {
      await api.deleteContentItem(courseId, item.id);
    }
  }

  async function toggleContentVisibility(item: CourseContentItem) {
    setContentActionError("");
    try {
      await updateContentInScope(item, { isVisible: !item.isVisible });
      await refresh();
    } catch (err) {
      setContentActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  async function removeContentItem(item: CourseContentItem) {
    const title = contentItemTitle(item);
    const confirmed = window.confirm(t("courseDetail.removeContentItemConfirm", { title }));
    if (!confirmed) {
      return;
    }

    setContentActionError("");
    try {
      if (item.courseGroupActivityId) {
        await api.deleteGroupActivityAssignment(courseId, item.groupId ?? groupId, item.courseGroupActivityId);
      } else if (item.activityId) {
        await api.deleteActivity(courseId, item.activityId);
      } else if (item.materialId && item.groupId && groupMaterialById.has(item.materialId)) {
        await api.deleteGroupMaterial(courseId, item.groupId, item.materialId);
      } else if (item.materialId) {
        await api.deleteMaterial(courseId, item.materialId);
      } else if (item.contentResourceId && item.groupId) {
        await api.deleteGroupContentResource(courseId, item.groupId, item.contentResourceId);
      } else if (item.contentResourceId) {
        await api.deleteCourseContentResource(courseId, item.contentResourceId);
      } else {
        await deleteContentInScope(item);
      }
      await refresh();
    } catch (err) {
      setContentActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  async function moveContentItemBesideTarget(dragged: CourseContentItem, target: CourseContentItem, placement: "before" | "after") {
    if ((dragged.groupId ?? null) !== (target.groupId ?? null)) {
      return;
    }

    const nextParentId = target.parentId ?? null;
    const nextGroupId = dragged.groupId ?? null;
    const siblings = contentItems
      .filter(
        (item) =>
          item.id !== dragged.id &&
          (item.parentId ?? null) === nextParentId &&
          (item.groupId ?? null) === nextGroupId
      )
      .sort(compareContentItems);
    const targetIndex = siblings.findIndex((item) => item.id === target.id);
    if (targetIndex === -1) {
      return;
    }

    siblings.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, {
      ...dragged,
      parentId: nextParentId,
      groupId: nextGroupId
    });

    await Promise.all(
      siblings.map((item, index) =>
        updateContentInScope(item, {
          parentId: nextParentId,
          position: index
        })
      )
    );
  }

  async function moveContentItemIntoFolder(dragged: CourseContentItem, folder: CourseContentItem) {
    await updateContentInScope(dragged, {
      parentId: folder.id,
      position: nextContentPosition(folder.id, dragged.groupId ?? null)
    });
  }

  async function moveContentItemToRoot(dragged: CourseContentItem) {
    await updateContentInScope(dragged, {
      parentId: null,
      position: nextContentPosition(null, dragged.groupId ?? null)
    });
  }

  async function moveContentItemSafely(action: () => Promise<void>) {
    setContentActionError("");
    try {
      await action();
      await refresh();
    } catch (err) {
      setContentActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  function nextContentPosition(parentId: string | null, groupId: string | null) {
    return contentItems.filter((item) => (item.parentId ?? null) === parentId && (item.groupId ?? null) === groupId).length;
  }

  function handleContentPointerDown(item: CourseContentItem, event: PointerEvent) {
    if (event.button !== 0 || !canManage) {
      return;
    }
    event.preventDefault();
    const title = contentItemTitle(item);
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    const activateDrag = (x: number, y: number) => {
      if (dragStarted) {
        return true;
      }
      const deltaX = x - startX;
      const deltaY = y - startY;
      if (deltaX * deltaX + deltaY * deltaY < contentDragActivationDistance * contentDragActivationDistance) {
        return false;
      }
      dragStarted = true;
      setDraggingContentItemId(item.id);
      setDragPreview({ title, x, y });
      return true;
    };

    const movePreview = (moveEvent: globalThis.PointerEvent) => {
      if (!activateDrag(moveEvent.clientX, moveEvent.clientY)) {
        return;
      }
      setDragPreview((current) => (current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current));
      setContentDropTarget(findContentDropTarget(moveEvent.clientX, moveEvent.clientY, item.id));
    };

    const finishDrag = async (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("pointermove", movePreview);
      const targetDescriptor = findContentDropTarget(upEvent.clientX, upEvent.clientY, item.id);
      setDraggingContentItemId(null);
      setDragPreview(null);
      setContentDropTarget(null);

      if (!dragStarted) {
        return;
      }

      if (targetDescriptor?.type === "root") {
        if (!item.parentId) {
          return;
        }
        await moveContentItemSafely(() => moveContentItemToRoot(item));
        return;
      }

      if (!targetDescriptor || targetDescriptor.type !== "content") {
        return;
      }

      const target = contentItems.find((candidate) => candidate.id === targetDescriptor.id);
      if (!target || target.id === item.id) {
        return;
      }

      await moveContentItemSafely(async () => {
        if (targetDescriptor.placement === "inside" && target.kind === "folder") {
          if (isContentDescendant(contentItems, target.id, item.id)) {
            setContentActionError(t("courseDetail.invalidFolderMove"));
            return;
          }
          await moveContentItemIntoFolder(item, target);
        } else {
          await moveContentItemBesideTarget(item, target, targetDescriptor.placement === "before" ? "before" : "after");
        }
      });
    };

    const cancelDrag = () => {
      setDraggingContentItemId(null);
      setDragPreview(null);
      setContentDropTarget(null);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointermove", movePreview);
    };

    window.addEventListener("pointermove", movePreview);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", cancelDrag, { once: true });
  }

  function findContentDropTarget(x: number, y: number, draggedId: string) {
    const element = document.elementFromPoint(x, y);
    if (element?.closest("[data-content-root-drop='true']")) {
      return { id: "root", type: "root" as const };
    }

    const itemElement = element?.closest("[data-content-item-id]");
    if (!(itemElement instanceof HTMLElement)) {
      return null;
    }

    const targetId = itemElement.dataset.contentItemId;
    if (!targetId || targetId === draggedId) {
      return null;
    }

    const target = contentItems.find((candidate) => candidate.id === targetId);
    const rect = itemElement.getBoundingClientRect();
    const relativeY = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
    let placement: ContentDropPlacement;
    if (target?.kind === "folder" && relativeY >= 0.25 && relativeY <= 0.75) {
      placement = "inside";
    } else {
      placement = relativeY < 0.5 ? "before" : "after";
    }

    return { id: targetId, placement, type: "content" as const };
  }

  async function saveAssignmentAvailability(assignmentId: string, availableFrom: string, availableUntil: string) {
    setSavingAssignmentId(assignmentId);
    setAssignmentError("");
    try {
      await api.updateGroupActivityAssignment(courseId, groupId, assignmentId, {
        availableFrom: toIsoOrNull(availableFrom),
        availableUntil: toIsoOrNull(availableUntil)
      });
      await refresh();
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : t("groupPage.assignmentUpdateError"));
    } finally {
      setSavingAssignmentId(null);
    }
  }

  async function removeAssignment(assignmentId: string, title: string) {
    const confirmed = window.confirm(t("groupPage.removeAssignmentConfirm", { title }));
    if (!confirmed) {
      return;
    }

    setAssignmentError("");
    try {
      await api.deleteGroupActivityAssignment(courseId, groupId, assignmentId);
      await refresh();
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : t("groupPage.assignmentDeleteError"));
    }
  }

  async function moveAssignmentRelativeToTarget(
    dragged: NonNullable<CourseGroup["activities"]>[number],
    target: NonNullable<CourseGroup["activities"]>[number]
  ) {
    const draggedIndex = assignedActivities.findIndex((assignment) => assignment.id === dragged.id);
    const targetIndexInOriginal = assignedActivities.findIndex((assignment) => assignment.id === target.id);
    const reordered = assignedActivities.filter((assignment) => assignment.id !== dragged.id);
    const targetIndex = reordered.findIndex((assignment) => assignment.id === target.id);
    const insertIndex = draggedIndex < targetIndexInOriginal ? targetIndex + 1 : targetIndex;
    reordered.splice(insertIndex, 0, dragged);

    await Promise.all(
      reordered.map((assignment, index) =>
        api.updateGroupActivityAssignment(courseId, groupId, assignment.id, {
          position: index
        })
      )
    );
  }

  async function moveAssignmentSafely(action: () => Promise<void>) {
    setAssignmentError("");
    try {
      await action();
      await refresh();
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : t("groupPage.assignmentReorderError"));
    }
  }

  function handleAssignmentPointerDown(
    assignment: NonNullable<CourseGroup["activities"]>[number],
    event: PointerEvent
  ) {
    if (event.button !== 0 || !canManage) {
      return;
    }
    event.preventDefault();
    setDraggingAssignmentId(assignment.id);
    setDragPreview({ title: assignment.activity.title, x: event.clientX, y: event.clientY });

    const movePreview = (moveEvent: globalThis.PointerEvent) => {
      setDragPreview((current) => (current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current));
      setAssignmentDropTargetId(findAssignmentDropTarget(moveEvent.clientX, moveEvent.clientY, assignment.id));
    };

    const finishDrag = async (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("pointermove", movePreview);
      const dropElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      setDraggingAssignmentId(null);
      setDragPreview(null);
      setAssignmentDropTargetId(null);

      const targetElement = dropElement?.closest("[data-assignment-id]");
      if (!(targetElement instanceof HTMLElement)) {
        return;
      }

      const target = assignedActivities.find((candidate) => candidate.id === targetElement.dataset.assignmentId);
      if (!target || target.id === assignment.id) {
        return;
      }

      await moveAssignmentSafely(() => moveAssignmentRelativeToTarget(assignment, target));
    };

    const cancelDrag = () => {
      setDraggingAssignmentId(null);
      setDragPreview(null);
      setAssignmentDropTargetId(null);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointermove", movePreview);
    };

    window.addEventListener("pointermove", movePreview);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", cancelDrag, { once: true });
  }

  function findAssignmentDropTarget(x: number, y: number, draggedId: string) {
    const element = document.elementFromPoint(x, y);
    const assignmentElement = element?.closest("[data-assignment-id]");
    if (!(assignmentElement instanceof HTMLElement)) {
      return null;
    }

    const targetId = assignmentElement.dataset.assignmentId;
    if (!targetId || targetId === draggedId) {
      return null;
    }

    return targetId;
  }

  async function addParticipant(event: FormEvent) {
    event.preventDefault();
    setParticipantError("");
    setSavingParticipant(true);

    try {
      await api.addGroupParticipant(courseId, groupId, {
        role: participantRole,
        firstName: participantCandidate ? undefined : participantFirstName,
        lastName: participantCandidate ? undefined : participantLastName,
        email: participantEmail,
        externalId: participantExternalId || null
      });
      await refresh();
      closeParticipantForm();
    } catch (err) {
      setParticipantError(err instanceof Error ? err.message : t("groupPage.participantCreateError"));
    } finally {
      setSavingParticipant(false);
    }
  }

  async function resolveParticipantEmail(event?: FocusEvent<HTMLInputElement>) {
    const nextEmail = (event?.target.value ?? participantEmail).trim().toLowerCase();
    if (!nextEmail) {
      setParticipantCandidate(null);
      setParticipantFirstName("");
      setParticipantLastName("");
      return;
    }

    setParticipantError("");
    setCheckingParticipantEmail(true);
    try {
      const result = await api.groupParticipantCandidate(courseId, nextEmail);
      setParticipantCandidate(result.candidate);
      if (result.candidate) {
        setParticipantFirstName(result.candidate.firstName);
        setParticipantLastName(result.candidate.lastName);
      } else {
        setParticipantFirstName("");
        setParticipantLastName("");
      }
    } catch (err) {
      setParticipantCandidate(null);
      setParticipantError(err instanceof Error ? err.message : t("groupPage.participantLookupError"));
    } finally {
      setCheckingParticipantEmail(false);
    }
  }

  async function removeParticipant(participant: GroupParticipant) {
    const confirmed = window.confirm(
      t("groupPage.removeParticipantConfirm", { name: `${participant.firstName} ${participant.lastName}`.trim() })
    );
    if (!confirmed) {
      return;
    }

    setParticipantError("");
    setRemovingParticipantId(participant.id);
    try {
      await api.removeGroupParticipant(courseId, groupId, participant.id);
      await refresh();
    } catch (err) {
      setParticipantError(err instanceof Error ? err.message : t("groupPage.participantDeleteError"));
    } finally {
      setRemovingParticipantId(null);
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        {group && course ? (
          <>
            <section className="hero-panel hero-panel-compact">
              <div className="hero-meta">
                <p className="eyebrow">{t("groupPage.eyebrow")} · {group.status === "published" ? t("groupPage.statusPublished") : t("groupPage.statusDraft")}</p>
                <h1>{course.title}: {group.title}</h1>
                {group.availableFrom || group.availableUntil ? (
                  <p className="muted">{formatAvailabilityWindow(group.availableFrom, group.availableUntil, t)}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="hero-actions">
                  <Link className="button secondary" href={`/courses/${courseId}`}>
                    {t("groupPage.backToCourse")}
                  </Link>
                </div>
              ) : null}
            </section>

            {error ? <p className="error">{error}</p> : null}

            <WorkspaceTabs
              ariaLabel={t("groupPage.workspaceTabs")}
              initialTab={searchParams.get("tab") === "gradebook" ? "gradebook" : "content"}
              tabs={[
                {
                  id: "activities",
                  label: t("groupPage.activitiesTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("groupPage.assignedActivitiesEyebrow")}</p>
                          <h2>{t("groupPage.assignedActivitiesTitle")}</h2>
                          <p className="muted">{t("groupPage.assignedActivitiesText")}</p>
                        </div>
                        {canManage ? (
                          <button
                            aria-label={isAssigningActivity ? t("common.cancel") : t("groupPage.assignActivityTitle")}
                            className="secondary icon-button section-action-icon-button"
                            title={isAssigningActivity ? t("common.cancel") : t("groupPage.assignActivityTitle")}
                            type="button"
                            onClick={() => setIsAssigningActivity((current) => !current)}
                          >
                            <MaterialActionIcon name={isAssigningActivity ? "close" : "activityAdd"} />
                          </button>
                        ) : null}
                      </div>

                      {canManage && isAssigningActivity ? (
                        <form className="form inline-panel" onSubmit={assignActivity}>
                          <div>
                            <p className="eyebrow">{t("groupPage.assignActivityEyebrow")}</p>
                            <h2>{t("groupPage.assignActivityTitle")}</h2>
                          </div>
                          <div className="grid compact-form-grid">
                            <div className="field">
                              <label htmlFor="assignActivity">{t("groupPage.availableActivities")}</label>
                              <select
                                id="assignActivity"
                                value={assignActivityId}
                                onChange={(event) => {
                                  const nextActivityId = event.target.value;
                                  const nextActivity = assignableActivities.find((activity) => activity.id === nextActivityId);
                                  setAssignActivityId(nextActivityId);
                                  setAssignAssessmentMode(nextActivity?.activityType.key === "test" ? "summative" : "formative");
                                }}
                                disabled={!assignableActivities.length || !canManage}
                              >
                                {assignableActivities.length ? (
                                  assignableActivities.map((activity) => (
                                    <option key={activity.id} value={activity.id}>
                                      {activity.title}
                                    </option>
                                  ))
                                ) : (
                                  <option value="">{t("groupPage.noAssignableActivities")}</option>
                                )}
                              </select>
                            </div>
                            <div className="field">
                              <label htmlFor="assignContentFolder">{t("courseDetail.contentFolderLabel")}</label>
                              <select
                                id="assignContentFolder"
                                value={assignParentId}
                                onChange={(event) => setAssignParentId(event.target.value)}
                                disabled={!canManage}
                              >
                                <option value="">{t("courseDetail.contentFolderRoot")}</option>
                                {contentFolderOptions.map(({ item: folder, depth }) => (
                                  <option key={folder.id} value={folder.id}>
                                    {formatFolderOptionLabel(folder, depth, t("courseDetail.untitledFolder"))}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <label className="checkbox-row" htmlFor="assignContentVisible">
                              <input
                                id="assignContentVisible"
                                type="checkbox"
                                checked={assignIsVisible}
                                disabled={!canManage}
                                onChange={(event) => setAssignIsVisible(event.target.checked)}
                              />
                              <span>{t("courseDetail.contentVisibleLabel")}</span>
                            </label>
                            <div className="field">
                              <label htmlFor="assignAvailableFrom">{t("groupPage.availableFrom")}</label>
                              <DateTimeMinuteInput
                                id="assignAvailableFrom"
                                value={assignAvailableFrom}
                                onChange={setAssignAvailableFrom}
                                disabled={!canManage}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor="assignAvailableUntil">{t("groupPage.availableUntil")}</label>
                              <DateTimeMinuteInput
                                id="assignAvailableUntil"
                                value={assignAvailableUntil}
                                onChange={setAssignAvailableUntil}
                                disabled={!canManage}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor="assignAssessmentMode">{t("groupPage.assessmentMode")}</label>
                              <select
                                id="assignAssessmentMode"
                                value={effectiveAssignAssessmentMode}
                                onChange={(event) => setAssignAssessmentMode(event.target.value as "formative" | "summative")}
                                disabled={!canManage || assignActivityIsTest}
                              >
                                <option value="formative">{t("groupPage.assessmentModeFormative")}</option>
                                <option value="summative">{t("groupPage.assessmentModeSummative")}</option>
                              </select>
                            </div>
                            {effectiveAssignAssessmentMode === "summative" ? (
                              <>
                                <div className="field">
                                  <label htmlFor="assignPointsPossible">{t("groupPage.pointsPossible")}</label>
                                  <input
                                    id="assignPointsPossible"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={assignPointsPossible}
                                    onChange={(event) => setAssignPointsPossible(event.target.value)}
                                    disabled={!canManage}
                                  />
                                </div>
                                <div className="field">
                                  <label htmlFor="assignGradingMode">{t("groupPage.gradingMode")}</label>
                                  <select
                                    id="assignGradingMode"
                                    value={assignGradingMode}
                                    onChange={(event) => setAssignGradingMode(event.target.value as "points" | "pass_fail")}
                                    disabled={!canManage}
                                  >
                                    <option value="points">{t("groupPage.gradingModePoints")}</option>
                                    <option value="pass_fail">{t("groupPage.gradingModePassFail")}</option>
                                  </select>
                                </div>
                                {assignGradingMode === "pass_fail" ? (
                                  <>
                                    <div className="field">
                                      <label htmlFor="assignPassThresholdPoints">{t("groupPage.passThresholdPoints")}</label>
                                      <input
                                        id="assignPassThresholdPoints"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={assignPassThresholdPoints}
                                        onChange={(event) => setAssignPassThresholdPoints(event.target.value)}
                                        disabled={!canManage}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor="assignPassThresholdOutOf">{t("groupPage.passThresholdOutOf")}</label>
                                      <input
                                        id="assignPassThresholdOutOf"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={assignPassThresholdOutOf}
                                        onChange={(event) => setAssignPassThresholdOutOf(event.target.value)}
                                        disabled={!canManage}
                                      />
                                    </div>
                                  </>
                                ) : null}
                                <div className="field">
                                  <label htmlFor="assignAttemptLimitMode">{t("groupPage.attemptLimitMode")}</label>
                                  <select
                                    id="assignAttemptLimitMode"
                                    value={assignAttemptLimitMode}
                                    onChange={(event) => setAssignAttemptLimitMode(event.target.value as "unlimited" | "max_attempts" | "until_due")}
                                    disabled={!canManage}
                                  >
                                    <option value="unlimited">{t("groupPage.attemptLimitUnlimited")}</option>
                                    <option value="max_attempts">{t("groupPage.attemptLimitMax")}</option>
                                    <option value="until_due">{t("groupPage.attemptLimitUntilDue")}</option>
                                  </select>
                                </div>
                                {assignAttemptLimitMode === "max_attempts" ? (
                                  <div className="field">
                                    <label htmlFor="assignMaxAttempts">{t("groupPage.maxAttempts")}</label>
                                    <input
                                      id="assignMaxAttempts"
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={assignMaxAttempts}
                                      onChange={(event) => setAssignMaxAttempts(event.target.value)}
                                      disabled={!canManage}
                                    />
                                  </div>
                                ) : null}
                                <div className="field">
                                  <label htmlFor="assignGradeStrategy">{t("groupPage.gradeStrategy")}</label>
                                  <select
                                    id="assignGradeStrategy"
                                    value={assignGradeStrategy}
                                    onChange={(event) => setAssignGradeStrategy(event.target.value as "latest" | "best" | "first" | "weighted_average")}
                                    disabled={!canManage}
                                  >
                                    <option value="latest">{t("groupPage.gradeStrategyLatest")}</option>
                                    <option value="best">{t("groupPage.gradeStrategyBest")}</option>
                                    <option value="first">{t("groupPage.gradeStrategyFirst")}</option>
                                    <option value="weighted_average">{t("groupPage.gradeStrategyWeightedAverage")}</option>
                                  </select>
                                </div>
                                {assignGradeStrategy === "weighted_average" ? (
                                  <label className="checkbox-row" htmlFor="assignDropLowestAttempt">
                                    <input
                                      id="assignDropLowestAttempt"
                                      type="checkbox"
                                      checked={assignDropLowestAttempt}
                                      disabled={!canManage}
                                      onChange={(event) => setAssignDropLowestAttempt(event.target.checked)}
                                    />
                                    <span>{t("groupPage.dropLowestAttempt")}</span>
                                  </label>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                          {assignmentError ? <p className="error">{assignmentError}</p> : null}
                          <div className="row">
                            <button type="submit" disabled={!assignActivityId || !assignableActivities.length || !canManage}>
                              {t("groupPage.assignActivity")}
                            </button>
                            <button className="secondary" type="button" onClick={() => setIsAssigningActivity(false)}>
                              {t("common.close")}
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {assignedActivities.length ? (
                        <div className="table-list">
                          <div className="table-row table-row-assignments table-head" aria-hidden="true">
                            <span />
                            <span>{t("courseDetail.titleHeader")}</span>
                            <span>{t("groupPage.availableFrom")}</span>
                            <span>{t("groupPage.availableUntil")}</span>
                            <span>{t("courseDetail.actionsHeader")}</span>
                          </div>
                          {assignedActivities.map((assignment) => (
                            <GroupActivityCard
                              key={assignment.id}
                              courseId={courseId}
                              groupId={groupId}
                              assignment={assignment}
                              activityLabel={activityCopy(assignment.activity.activityType.key).name}
                              canManage={Boolean(canManage)}
                              dragging={draggingAssignmentId === assignment.id}
                              dropTarget={assignmentDropTargetId === assignment.id}
                              saving={savingAssignmentId === assignment.id}
                              t={t}
                              onDragStart={handleAssignmentPointerDown}
                              onSave={saveAssignmentAvailability}
                              onRemove={removeAssignment}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="muted">{t("groupPage.noAssignedActivities")}</p>
                      )}
                      {assignmentError ? <p className="error">{assignmentError}</p> : null}
                    </section>
                  )
                },
                {
                  id: "content",
                  label: t("courseDetail.contentTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("courseDetail.contentEyebrow")}</p>
                          <h2>{t("courseDetail.contentTitle")}</h2>
                          <p className="muted">{t("courseDetail.contentText")}</p>
                        </div>
                      </div>

                      {visibleContentItems.length ? (
                        <div className="table-list">
                          <div
                            className={`root-drop-zone ${draggingContentItemId ? "is-active" : ""} ${
                              contentDropTarget?.type === "root" ? "is-drop-target" : ""
                            }`}
                            data-content-root-drop="true"
                          >
                            {t("courseDetail.moveToTopLevel")}
                          </div>
                          {visibleContentItems.map(({ item, depth }) => {
                            const title = contentItemTitle(item);
                            const href = contentItemHref(item);
                            const contentResource = item.contentResourceId ? contentResourceById.get(item.contentResourceId) : null;
                            const contentResourceDefinition = contentResource ? contentTypeByKey.get(contentResource.contentTypeKey) ?? null : null;
                            const contentResourceIsUnavailable = Boolean(contentResource && !contentResourceDefinition);
                            const contentResourceIsFile = contentResourceDefinition?.embeddingSource === "file_upload";
                            const isCollapsed = collapsedContentFolderIds.has(item.id);
                            const assignment = item.courseGroupActivityId ? assignmentById.get(item.courseGroupActivityId) : null;
                            const courseActivity = item.activityId ? courseActivityById.get(item.activityId) : null;
                            const activityTypeKey = assignment?.activity.activityType.key ?? courseActivity?.activityType.key ?? null;
                            const activityLabel = activityTypeKey ? activityCopy(activityTypeKey).name : null;
                            const isCourseWideAssignment = assignment?.metadata?.assignmentScope === "course_all_groups";
                            const isCourseWideSettingsLocked = assignment?.metadata?.enablePerGroupSettings === false;
                            const assessmentMode =
                              assignment?.metadata?.assessmentMode === "summative"
                                ? t("groupPage.assessmentModeSummative")
                                : assignment
                                  ? t("groupPage.assessmentModeFormative")
                                  : null;
                            const availabilityLabel = assignment
                              ? formatAvailabilityWindow(assignment.availableFrom, assignment.availableUntil, t)
                              : null;
                            const metadataBadges = [
                              activityLabel ? <span className="metadata-badge is-activity-type" key="activity-type">{activityLabel}</span> : null,
                              isCourseWideAssignment ? (
                                <span className="metadata-badge is-course-wide" key="course-wide">
                                  {t("groupPage.courseWideAssignment")}
                                </span>
                              ) : null,
                              isCourseWideSettingsLocked ? (
                                <span className="metadata-badge" key="course-wide-locked">
                                  {t("groupPage.courseWideSettingsLocked")}
                                </span>
                              ) : null,
                              assessmentMode ? <span className="metadata-badge" key="assessment-mode">{assessmentMode}</span> : null,
                              availabilityLabel ? <span className="metadata-badge" key="availability">{availabilityLabel}</span> : null,
                              contentResourceIsUnavailable ? (
                                <span className="metadata-badge is-warning" key="content-plugin-unavailable">
                                  {t("courseDetail.contentPluginUnavailable")}
                                </span>
                              ) : null
                            ].filter(Boolean);
                            const isHidden = item.effectiveVisibility ? item.effectiveVisibility !== "visible" : !item.isVisible;

                            return (
                              <div
                                className={`table-row table-row-content-tree ${draggingContentItemId === item.id ? "is-dragging" : ""} ${
                                  contentDropTarget?.type === "content" && contentDropTarget.id === item.id ? "is-drop-target" : ""
                                } ${item.kind === "folder" ? "is-folder-row" : ""} ${isHidden ? "is-hidden-content" : ""} ${
                                  contentDropTarget?.type === "content" && contentDropTarget.id === item.id
                                    ? `is-drop-${contentDropTarget.placement}`
                                    : ""
                                }`}
                                data-content-item-id={item.id}
                                key={item.id}
                                style={{ "--content-tree-indent": `${14 + depth * 20}px`, paddingLeft: 14 + depth * 20 } as CSSProperties}
                              >
                                <div className="table-main table-main-stack">
                                  <span
                                    aria-label={t("courseDetail.dragContentItem", { title })}
                                    className="drag-handle"
                                    role="button"
                                    tabIndex={0}
                                    title={t("courseDetail.dragToMove")}
                                    onPointerDown={(event) => handleContentPointerDown(item, event)}
                                  >
                                    <MaterialActionIcon name="drag" />
                                  </span>
                                  {item.kind === "folder" ? (
                                    <button
                                      aria-label={
                                        isCollapsed
                                          ? t("courseDetail.expandFolder", { title })
                                          : t("courseDetail.collapseFolder", { title })
                                      }
                                      className="content-item-icon-button"
                                      title={isCollapsed ? t("courseDetail.expandFolderTitle") : t("courseDetail.collapseFolderTitle")}
                                      type="button"
                                      onClick={() => toggleContentFolder(item.id)}
                                    >
                                      <FolderContentIcon collapsed={isCollapsed} />
                                    </button>
                                  ) : (
                                    <span className="content-item-icon">
                                      {item.kind === "activity" ? (
                                        <ActivityContentIcon />
                                      ) : (
                                        <MaterialTypeIcon iconName={contentItemMaterialIconName(item)} />
                                      )}
                                    </span>
                                  )}
                                  <strong>
                                    {href && contentResource ? (
                                      <a href={href} rel={contentResourceIsFile ? undefined : "noreferrer"} target={contentResourceIsFile ? undefined : "_blank"}>
                                        {title}
                                      </a>
                                    ) : href ? (
                                      <Link href={href}>{title}</Link>
                                    ) : (
                                      title
                                    )}
                                  </strong>
                                  {metadataBadges.length ? <span className="metadata-badges">{metadataBadges}</span> : null}
                                </div>
                                <div className="table-actions content-row-actions">
                                  {href ? (
                                    contentResource ? (
                                      <a
                                        aria-label={t(contentResourceIsFile ? "courseDetail.downloadMaterial" : "courseDetail.openContentItem", { title })}
                                        className="button secondary icon-button"
                                        href={href}
                                        rel={contentResourceIsFile ? undefined : "noreferrer"}
                                        target={contentResourceIsFile ? undefined : "_blank"}
                                        title={t(contentResourceIsFile ? "common.download" : "common.open")}
                                      >
                                        <MaterialActionIcon name={contentResourceIsFile ? "download" : "open"} />
                                      </a>
                                    ) : (
                                    <Link
                                      aria-label={t("courseDetail.openContentItem", { title })}
                                      className="button secondary icon-button"
                                      href={href}
                                      title={t("common.open")}
                                    >
                                      <MaterialActionIcon name="open" />
                                    </Link>
                                    )
                                  ) : (
                                    <span className="action-slot" aria-hidden="true" />
                                  )}
                                  <span className="action-slot" aria-hidden="true" />
                                  <button
                                    aria-label={item.isVisible ? t("courseDetail.hideContentItem", { title }) : t("courseDetail.showContentItem", { title })}
                                    className="secondary icon-button"
                                    title={item.isVisible ? t("courseDetail.contentHidden") : t("courseDetail.contentVisible")}
                                    type="button"
                                    onClick={() => toggleContentVisibility(item)}
                                  >
                                    <MaterialActionIcon name={item.isVisible ? "hidden" : "visible"} />
                                  </button>
                                  <button
                                    aria-label={t("courseDetail.removeContentItem", { title })}
                                    className="danger icon-button"
                                    title={t("common.remove")}
                                    type="button"
                                    onClick={() => removeContentItem(item)}
                                  >
                                    <MaterialActionIcon name="remove" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="muted">{t("courseDetail.noContentItems")}</p>
                      )}
                      {contentActionError ? <p className="error">{contentActionError}</p> : null}
                    </section>
                  )
                },
                {
                  id: "gradebook",
                  label: t("groupPage.gradebookTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("groupPage.gradebookEyebrow")}</p>
                          <h2>{t("groupPage.gradebookTitle")}</h2>
                        </div>
                        <a
                          className="button secondary"
                          href={api.courseGradebookCsvUrl(courseId, {
                            groupId,
                            activityId: gradebookActivityId || undefined,
                            status: gradebookStatus
                          })}
                        >
                          {t("courseDetail.exportCsv")}
                        </a>
                      </div>
                      <div className="form inline-panel gradebook-filters">
                        <div className="field">
                          <label htmlFor="group-gradebook-activity-filter">{t("courseDetail.activityFilter")}</label>
                          <select
                            id="group-gradebook-activity-filter"
                            value={gradebookActivityId}
                            onChange={(event) => setGradebookActivityId(event.target.value)}
                          >
                            <option value="">{t("courseDetail.allActivities")}</option>
                            {(gradebook?.activities ?? []).map((activity) => (
                              <option key={activity.id} value={activity.id}>
                                {activity.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="group-gradebook-status-filter">{t("courseDetail.statusFilter")}</label>
                          <select
                            id="group-gradebook-status-filter"
                            value={gradebookStatus}
                            onChange={(event) => setGradebookStatus(event.target.value as GradebookStatus)}
                          >
                            <option value="all">{t("courseDetail.gradebookStatusAll")}</option>
                            <option value="missing">{t("courseDetail.gradebookStatusMissing")}</option>
                            <option value="late">{t("courseDetail.gradebookStatusLate")}</option>
                            <option value="needs_grading">{t("courseDetail.gradebookStatusNeedsGrading")}</option>
                            <option value="graded">{t("courseDetail.gradebookStatusGraded")}</option>
                          </select>
                        </div>
                      </div>
                      <div className="gradebook-summary-bar">
                        <div className="gradebook-summary-card">
                          <span className="table-meta-note muted">{t("courseDetail.activitiesHeader")}</span>
                          <strong>{gradebookOverview.activityCount}</strong>
                        </div>
                        <div className="gradebook-summary-card">
                          <span className="table-meta-note muted">{t("courseDetail.submissionsHeader")}</span>
                          <strong>{gradebookOverview.submissionCount}</strong>
                        </div>
                        <div className="gradebook-summary-card">
                          <span className="table-meta-note muted">{t("courseDetail.gradedHeader")}</span>
                          <strong>{gradebookOverview.gradedCount}</strong>
                        </div>
                        <div className="gradebook-summary-card">
                          <span className="table-meta-note muted">{t("courseDetail.meanGradeHeader")}</span>
                          <strong>{formatMeanGrade(gradebookOverview.meanScore, gradebookOverview.meanMaxScore)}</strong>
                        </div>
                      </div>

                      {gradebookActivities.length ? (
                        <div className="table-list gradebook-table">
                          <div className="table-row table-row-gradebook-activity table-head" aria-hidden="true">
                            <span>{t("courseDetail.activityHeader")}</span>
                            <span>{t("courseDetail.submissionsHeader")}</span>
                            <span>{t("courseDetail.gradedHeader")}</span>
                            <span>{t("courseDetail.meanGradeHeader")}</span>
                            <span>{t("courseDetail.releaseHeader")}</span>
                            <span>{t("courseDetail.actionsHeader")}</span>
                          </div>
                          {gradebookActivities.map((activity) => (
                            <div className="table-row table-row-gradebook-activity" key={activity.activityId}>
                              <div className="gradebook-activity-cell is-static">
                                <div className="table-main table-main-stack">
                                  <strong>{activity.activityTitle}</strong>
                                  <span className="table-meta-note muted">{activity.activityTypeName}</span>
                                </div>
                              </div>
                              <span className="gradebook-number">{activity.submissionCount}</span>
                              <span className="gradebook-number">{activity.gradedCount}</span>
                              <strong className="gradebook-number">{formatMeanGrade(activity.meanScore, activity.meanMaxScore)}</strong>
                              <div className="table-actions">
                                <button
                                  className="button secondary"
                                  disabled={savingReleaseItemId === activity.gradebookItemId}
                                  type="button"
                                  onClick={() => setGradebookRelease(activity.gradebookItemId, !activity.gradesReleased, activity.activityTitle)}
                                >
                                  {activity.gradesReleased ? t("courseDetail.hideGrades") : t("courseDetail.releaseGrades")}
                                </button>
                              </div>
                              <div className="table-actions">
                                <Link
                                  className="button secondary"
                                  href={`/courses/${courseId}/gradebook/activities/${activity.activityId}?groupId=${groupId}`}
                                >
                                  {t("courseDetail.detailedResults")}
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">{t("courseDetail.noGradebookRows")}</p>
                      )}
                    </section>
                  )
                },
                {
                  id: "participants",
                  label: t("groupPage.participantsTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("groupPage.participantsEyebrow")}</p>
                          <h2>{t("groupPage.participantsTitle")}</h2>
                          <p className="muted">{t("groupPage.participantsText")}</p>
                        </div>
                        {canManage ? (
                          <button className="secondary" type="button" onClick={() => setIsAddingParticipant((current) => !current)}>
                            {isAddingParticipant ? t("common.cancel") : t("groupPage.addParticipant")}
                          </button>
                        ) : null}
                      </div>

                      {canManage && isAddingParticipant ? (
                        <form className="form inline-panel" onSubmit={addParticipant}>
                          <div>
                            <p className="eyebrow">{t("groupPage.addParticipantEyebrow")}</p>
                            <h2>{t("groupPage.addParticipantTitle")}</h2>
                            <p className="muted">{t("groupPage.addParticipantText")}</p>
                          </div>
                          <div className="grid compact-form-grid">
                            <div className="field">
                              <label htmlFor="participant-email">{t("groupPage.participantEmail")}</label>
                              <input
                                id="participant-email"
                                type="email"
                                value={participantEmail}
                                onBlur={(event) => void resolveParticipantEmail(event)}
                                onChange={(event) => {
                                  setParticipantEmail(event.target.value);
                                  setParticipantCandidate(null);
                                  setParticipantFirstName("");
                                  setParticipantLastName("");
                                  setParticipantError("");
                                }}
                                required
                              />
                            </div>
                            <div className="field">
                              <label htmlFor="participant-role">{t("groupPage.participantRole")}</label>
                              <select
                                id="participant-role"
                                value={participantRole}
                                onChange={(event) => setParticipantRole(event.target.value as typeof participantRole)}
                              >
                                <option value="student">{t("groupPage.participantRoleStudent")}</option>
                                <option value="ta">{t("groupPage.participantRoleTa")}</option>
                                <option value="teacher">{t("groupPage.participantRoleTeacher")}</option>
                              </select>
                            </div>
                            <div className={`field ${participantCandidate ? "field-readonly" : ""}`}>
                              <label htmlFor="participant-first-name">{t("groupPage.participantFirstName")}</label>
                              <input
                                id="participant-first-name"
                                value={participantFirstName}
                                onChange={(event) => setParticipantFirstName(event.target.value)}
                                readOnly={Boolean(participantCandidate)}
                                required={!participantCandidate}
                              />
                            </div>
                            <div className={`field ${participantCandidate ? "field-readonly" : ""}`}>
                              <label htmlFor="participant-last-name">{t("groupPage.participantLastName")}</label>
                              <input
                                id="participant-last-name"
                                value={participantLastName}
                                onChange={(event) => setParticipantLastName(event.target.value)}
                                readOnly={Boolean(participantCandidate)}
                                required={!participantCandidate}
                              />
                            </div>
                            <div className={`field ${participantCandidate ? "field-readonly" : ""}`}>
                              <label htmlFor="participant-external-id">{t("groupPage.participantExternalId")}</label>
                              <input
                                id="participant-external-id"
                                value={participantExternalId}
                                onChange={(event) => setParticipantExternalId(event.target.value)}
                                placeholder={t("groupPage.participantExternalIdPlaceholder")}
                                readOnly={Boolean(participantCandidate)}
                              />
                            </div>
                          </div>
                          <p className="muted">
                            {checkingParticipantEmail
                              ? t("groupPage.participantLookupChecking")
                              : participantCandidate
                                ? t("groupPage.participantLookupFound", { name: participantCandidate.name || participantCandidate.email })
                                : t("groupPage.participantLookupNew")}
                          </p>
                          <p className="muted">{t("groupPage.pendingAccountHelp")}</p>
                          {participantError ? <p className="error">{participantError}</p> : null}
                          <div className="row">
                            <button type="submit" disabled={savingParticipant}>
                              {savingParticipant ? t("common.saving") : t("groupPage.addParticipant")}
                            </button>
                            <button className="secondary" type="button" onClick={closeParticipantForm}>
                              {t("common.close")}
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {participants.length ? (
                        <div className="table-list">
                          <div className="table-row table-row-participants table-head" aria-hidden="true">
                            <span>{t("groupPage.participantNameHeader")}</span>
                            <span>{t("groupPage.participantRoleHeader")}</span>
                            <span>{t("groupPage.participantEmailHeader")}</span>
                            <span>{t("groupPage.participantExternalIdHeader")}</span>
                            <span>{t("groupPage.participantStatusHeader")}</span>
                            <span>{t("courseDetail.actionsHeader")}</span>
                          </div>
                          {participants.map((participant) => (
                            <div className="table-row table-row-participants" key={participant.id}>
                              <div className="table-main table-main-stack">
                                <strong>{participant.firstName} {participant.lastName}</strong>
                              </div>
                              <span className={`participant-role participant-role-${participant.role}`}>
                                {participant.role === "teacher"
                                  ? t("groupPage.participantRoleTeacher")
                                  : participant.role === "ta"
                                    ? t("groupPage.participantRoleTa")
                                    : t("groupPage.participantRoleStudent")}
                              </span>
                              <span className="table-meta">{participant.email}</span>
                              <span className="table-meta">{participant.externalId || t("groupPage.noExternalId")}</span>
                              <span className={`participant-status ${participant.userId ? "is-linked" : "is-pending"}`}>
                                {participant.userId ? t("groupPage.participantStatusLinked") : t("groupPage.participantStatusPending")}
                              </span>
                              <div className="table-actions">
                                {canManage ? (
                                  <button
                                    aria-label={t("groupPage.removeParticipant")}
                                    className="danger icon-button"
                                    disabled={removingParticipantId === participant.id || participant.userId === user?.id}
                                    title={participant.userId === user?.id ? t("groupPage.removeSelfBlocked") : t("groupPage.removeParticipant")}
                                    type="button"
                                    onClick={() => void removeParticipant(participant)}
                                  >
                                    <MaterialActionIcon name="remove" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">{t("groupPage.noParticipants")}</p>
                      )}
                      {participantError ? <p className="error">{participantError}</p> : null}
                    </section>
                  )
                },
                {
                  id: "settings",
                  label: t("groupPage.settingsTab"),
                  render: () =>
                    canManage ? (
                      <section className="section">
                        <form className="form" onSubmit={saveGroupSettings}>
                      <div>
                        <p className="eyebrow">{t("groupPage.settingsEyebrow")}</p>
                        <h2>{t("groupPage.settingsTitle")}</h2>
                      </div>
                      <div className="field">
                        <label htmlFor="group-title">{t("courseDetail.groupTitle")}</label>
                        <input
                          id="group-title"
                          value={groupTitle}
                          onChange={(event) => setGroupTitle(event.target.value)}
                          required
                          minLength={2}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="group-status">{t("groupPage.statusLabel")}</label>
                        <select id="group-status" value={groupStatus} onChange={(event) => setGroupStatus(event.target.value as "draft" | "published")}>
                          <option value="draft">{t("groupPage.statusDraft")}</option>
                          <option value="published">{t("groupPage.statusPublished")}</option>
                        </select>
                      </div>
                      <div className="split">
                        <div className="field">
                          <label htmlFor="group-available-from">{t("groupPage.availableFrom")}</label>
                          <DateTimeMinuteInput
                            id="group-available-from"
                            value={groupAvailableFrom}
                            onChange={setGroupAvailableFrom}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="group-available-until">{t("groupPage.availableUntil")}</label>
                          <DateTimeMinuteInput
                            id="group-available-until"
                            value={groupAvailableUntil}
                            onChange={setGroupAvailableUntil}
                          />
                        </div>
                      </div>
                      <div className="row">
                        <button type="submit" disabled={savingGroup}>
                          {savingGroup ? t("common.saving") : t("groupPage.saveSettings")}
                        </button>
                      </div>
                        </form>
                      </section>
                    ) : (
                      <section className="section stack">
                        <p className="muted">{t("groupPage.settingsReadOnly")}</p>
                      </section>
                    )
                }
              ].filter((tab) => tab.id !== "activities" && tab.id !== "materials")}
            />
            {dragPreview ? (
              <div className="drag-preview" style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }}>
                {dragPreview.title}
              </div>
            ) : null}
          </>
        ) : (
          <p>{t("common.loading")}</p>
        )}
      </main>
    </AppShell>
  );
}

function GroupActivityCard({
  courseId,
  groupId,
  assignment,
  activityLabel,
  canManage,
  dragging,
  dropTarget,
  saving,
  t,
  onDragStart,
  onSave,
  onRemove
}: {
  courseId: string;
  groupId: string;
  assignment: NonNullable<CourseGroup["activities"]>[number];
  activityLabel: string;
  canManage: boolean;
  dragging: boolean;
  dropTarget: boolean;
  saving: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onDragStart: (assignment: NonNullable<CourseGroup["activities"]>[number], event: PointerEvent) => void;
  onSave: (assignmentId: string, availableFrom: string, availableUntil: string) => Promise<void>;
  onRemove: (assignmentId: string, title: string) => Promise<void>;
}) {
  const [availableFrom, setAvailableFrom] = useState(toDateTimeLocalValue(assignment.availableFrom));
  const [availableUntil, setAvailableUntil] = useState(toDateTimeLocalValue(assignment.availableUntil));
  const isCourseWideAssignment = assignment.metadata?.assignmentScope === "course_all_groups";
  const canEditAvailability = canManage && (!isCourseWideAssignment || assignment.metadata?.enablePerGroupSettings !== false);
  const canRemoveLocally = canManage && !isCourseWideAssignment;

  useEffect(() => {
    setAvailableFrom(toDateTimeLocalValue(assignment.availableFrom));
    setAvailableUntil(toDateTimeLocalValue(assignment.availableUntil));
  }, [assignment.availableFrom, assignment.availableUntil]);

  return (
    <div
      className={`table-row table-row-assignments ${dragging ? "is-dragging" : ""} ${dropTarget ? "is-drop-target" : ""}`}
      data-assignment-id={assignment.id}
    >
      {canManage ? (
        <span
          aria-label={t("groupPage.dragAssignment", { title: assignment.activity.title })}
          className="drag-handle"
          role="button"
          tabIndex={0}
          title={t("groupPage.dragAssignmentTitle")}
          onPointerDown={(event) => onDragStart(assignment, event)}
        >
          <MaterialActionIcon name="drag" />
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="table-main table-main-stack assignment-main">
        <span className="eyebrow">{activityLabel}</span>
        <strong>
          <Link href={`/courses/${courseId}/groups/${groupId}/activities/assigned/${assignment.activity.id}`}>{assignment.activity.title}</Link>
        </strong>
        {assignment.activity.description ? (
          <MarkdownRenderer markdown={assignment.activity.description} className="table-meta-note muted" compact />
        ) : (
          <span className="table-meta-note muted">{t("common.noDescription")}</span>
        )}
        {isCourseWideAssignment ? (
          <span className="metadata-badges">
            <span className="metadata-badge is-course-wide">{t("groupPage.courseWideAssignment")}</span>
            {assignment.metadata?.enablePerGroupSettings === false ? (
              <span className="metadata-badge">{t("groupPage.courseWideSettingsLocked")}</span>
            ) : null}
          </span>
        ) : null}
        <span className="metadata-badges">
          <span className="metadata-badge">
            {assignment.metadata?.assessmentMode === "summative"
              ? t("groupPage.assessmentModeSummative")
              : t("groupPage.assessmentModeFormative")}
          </span>
        </span>
      </div>
      <div className="field assignment-date-field">
        <label className="sr-only" htmlFor={`available-from-${assignment.id}`}>{t("groupPage.availableFrom")}</label>
        <DateTimeMinuteInput
          id={`available-from-${assignment.id}`}
          value={availableFrom}
          onChange={setAvailableFrom}
          disabled={saving || !canEditAvailability}
        />
      </div>
      <div className="field assignment-date-field">
        <label className="sr-only" htmlFor={`available-until-${assignment.id}`}>{t("groupPage.availableUntil")}</label>
        <DateTimeMinuteInput
          id={`available-until-${assignment.id}`}
          value={availableUntil}
          onChange={setAvailableUntil}
          disabled={saving || !canEditAvailability}
        />
      </div>
      <div className="table-actions">
        <Link
          aria-label={t("courseDetail.openActivity")}
          className="button secondary icon-button"
          href={`/courses/${courseId}/groups/${groupId}/activities/assigned/${assignment.activity.id}`}
          title={t("courseDetail.openActivity")}
        >
          <MaterialActionIcon name="open" />
        </Link>
        <button
          aria-label={t("common.save")}
          className="icon-button"
          type="button"
          disabled={saving || !canEditAvailability}
          title={saving ? t("common.saving") : t("common.save")}
          onClick={() => void onSave(assignment.id, availableFrom, availableUntil)}
        >
          <MaterialActionIcon name="save" />
        </button>
        <button
          aria-label={t("groupPage.removeAssignment")}
          className="danger icon-button"
          type="button"
          disabled={saving || !canRemoveLocally}
          title={isCourseWideAssignment ? t("groupPage.courseWideAssignmentLocked") : t("groupPage.removeAssignment")}
          onClick={() => void onRemove(assignment.id, assignment.activity.title)}
        >
          <MaterialActionIcon name="remove" />
        </button>
      </div>
    </div>
  );
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function withDownloadVersion(url: string, material: CourseMaterial | CourseGroupMaterial | CourseContentResource) {
  const version =
    typeof material.metadata?.storedName === "string"
      ? material.metadata.storedName
      : typeof material.metadata?.originalName === "string"
        ? material.metadata.originalName
        : null;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function legacyMaterialHasStoredFile(material: CourseMaterial | CourseGroupMaterial) {
  return typeof material.metadata?.storedName === "string";
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAvailabilityWindow(
  availableFrom: string | null | undefined,
  availableUntil: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (!availableFrom && !availableUntil) {
    return t("groupPage.availableAlways");
  }

  if (availableFrom && availableUntil) {
    return t("groupPage.availableWindow", {
      from: formatAvailabilityValue(availableFrom),
      until: formatAvailabilityValue(availableUntil)
    });
  }

  if (availableFrom) {
    return t("groupPage.availableAfter", { from: formatAvailabilityValue(availableFrom) });
  }

  return t("groupPage.availableBefore", { until: formatAvailabilityValue(availableUntil as string) });
}

function getAvailabilityStatus(
  availableFrom: string | null | undefined,
  availableUntil: string | null | undefined,
  now: number
): "available" | "upcoming" | "expired" {
  if (availableFrom && new Date(availableFrom).getTime() > now) {
    return "upcoming";
  }
  if (availableUntil && new Date(availableUntil).getTime() < now) {
    return "expired";
  }
  return "available";
}

function formatAvailabilityValue(value: string) {
  const date = new Date(value);
  const isMidnight =
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0;

  if (isMidnight) {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(date);
}

function StudentFeedback({
  feedback,
  maxScore,
  t
}: {
  feedback: StudentGradeFeedback | null;
  maxScore: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!feedback) {
    return null;
  }
  const parsonsDetails = getParsonsFeedbackDetails(feedback);

  return (
    <div className="stack stack-tight">
      {feedback.feedbackText ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          <p className="muted">{feedback.feedbackText}</p>
        </div>
      ) : null}
      {parsonsDetails.messages.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          {parsonsDetails.messages.map((message) => (
            <p className="muted" key={message.type}>
              {message.type === "order"
                ? t("parsons.orderFeedback", { count: message.count })
                : t("parsons.indentFeedback", { count: message.count })}
            </p>
          ))}
        </div>
      ) : null}
      {parsonsDetails.grading.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.gradingBreakdownTitle")}</strong>
          {scaleFeedbackGrading(parsonsDetails.grading, maxScore).map((component) => (
            <p className="muted" key={component.type}>
              {t(component.type === "order" ? "groupPage.parsonsOrderScore" : "groupPage.parsonsIndentationScore", {
                score: formatGradeNumber(component.awarded),
                max: formatGradeNumber(component.possible)
              })}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ParsonsFeedbackMessage = { type: "order" | "indentation"; count: number };
type ParsonsFeedbackGrading = { type: "order" | "indentation"; awardedRaw: number; possibleRaw: number };

function getParsonsFeedbackDetails(feedback: StudentGradeFeedback) {
  const details = feedback.kind === "parsons" && feedback.details && typeof feedback.details === "object" ? feedback.details : {};
  const messages = Array.isArray(details.messages)
    ? details.messages
        .map((message) => {
          const item = message && typeof message === "object" ? (message as Record<string, unknown>) : null;
          const type = item?.type;
          const count = typeof item?.count === "number" ? item.count : null;
          return (type === "order" || type === "indentation") && count !== null ? { type, count } : null;
        })
        .filter((message): message is ParsonsFeedbackMessage => message !== null)
    : [];
  const grading = Array.isArray(details.grading)
    ? details.grading
        .map((component) => {
          const item = component && typeof component === "object" ? (component as Record<string, unknown>) : null;
          const type = item?.type;
          const awardedRaw = typeof item?.awardedRaw === "number" ? item.awardedRaw : null;
          const possibleRaw = typeof item?.possibleRaw === "number" ? item.possibleRaw : null;
          return (type === "order" || type === "indentation") && awardedRaw !== null && possibleRaw !== null
            ? { type, awardedRaw, possibleRaw }
            : null;
        })
        .filter((component): component is ParsonsFeedbackGrading => component !== null)
    : [];
  return { messages, grading };
}

function scaleFeedbackGrading(grading: ParsonsFeedbackGrading[], maxScore: number) {
  const rawTotal = grading.reduce((sum, component) => sum + component.possibleRaw, 0);
  const scale = rawTotal > 0 ? maxScore / rawTotal : 1;
  return grading.map((component) => ({
    type: component.type,
    awarded: component.awardedRaw * scale,
    possible: component.possibleRaw * scale
  }));
}

function formatGradebookScore(score: number | null, maxScore: number) {
  if (score === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMeanGrade(score: number | null, maxScore: number | null) {
  if (score === null || maxScore === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

type GroupGradebookActivitySummary = {
  activityId: string;
  activityTitle: string;
  activityTypeName: string;
  gradebookItemId: string;
  gradesReleased: boolean;
  submissionCount: number;
  gradedCount: number;
  meanScore: number | null;
  meanMaxScore: number | null;
};

function buildGroupGradebookActivitySummaries(
  items: CourseGradebookItemSummary[],
  rows: CourseGradebookRow[]
): GroupGradebookActivitySummary[] {
  const rowsByItem = new Map<string, CourseGradebookRow[]>();
  for (const row of rows) {
    const existing = rowsByItem.get(row.gradebookItemId) ?? [];
    existing.push(row);
    rowsByItem.set(row.gradebookItemId, existing);
  }

  return items
    .map((item) => {
      const itemRows = rowsByItem.get(item.gradebookItemId) ?? [];
      return {
        activityId: item.activityId,
        activityTitle: item.activityTitle,
        activityTypeName: item.activityTypeName,
        gradebookItemId: item.gradebookItemId,
        gradesReleased: item.gradesReleased,
        submissionCount: sum(itemRows.map((row) => row.submittedAttemptCount)),
        gradedCount: itemRows.filter((row) => row.score !== null).length,
        ...meanGradeForRows(itemRows)
      };
    })
    .sort((left, right) => left.activityTitle.localeCompare(right.activityTitle));
}

function buildGroupGradebookOverview(activities: GroupGradebookActivitySummary[]) {
  const rowsForMean = activities.flatMap((activity) =>
    activity.meanScore === null || activity.meanMaxScore === null
      ? []
      : [{ score: activity.meanScore, maxScore: activity.meanMaxScore }]
  );

  return {
    activityCount: activities.length,
    submissionCount: sum(activities.map((activity) => activity.submissionCount)),
    gradedCount: sum(activities.map((activity) => activity.gradedCount)),
    meanScore: rowsForMean.length ? roundGrade(rowsForMean.reduce((total, row) => total + row.score, 0) / rowsForMean.length) : null,
    meanMaxScore: rowsForMean.length ? roundGrade(rowsForMean.reduce((total, row) => total + row.maxScore, 0) / rowsForMean.length) : null
  };
}

function meanGradeForRows(rows: CourseGradebookRow[]) {
  const gradedRows = rows.filter((row) => row.score !== null);
  if (!gradedRows.length) {
    return { meanScore: null, meanMaxScore: null };
  }

  return {
    meanScore: roundGrade(gradedRows.reduce((total, row) => total + (row.score ?? 0), 0) / gradedRows.length),
    meanMaxScore: roundGrade(gradedRows.reduce((total, row) => total + row.maxScore, 0) / gradedRows.length)
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundGrade(value: number) {
  return Math.round(value * 100) / 100;
}

function compareContentItems(left: CourseContentItem, right: CourseContentItem) {
  const leftTitle = left.titleSnapshot ?? "";
  const rightTitle = right.titleSnapshot ?? "";
  return left.position - right.position || leftTitle.localeCompare(rightTitle);
}

function setsAreEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function flattenContentItems(contentItems: CourseContentItem[], collapsedFolderIds: Set<string>) {
  const itemIds = new Set(contentItems.map((item) => item.id));
  const byParent = new Map<string, CourseContentItem[]>();
  for (const item of contentItems) {
    const parentId = item.parentId ?? "root";
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), item]);
  }

  for (const [parentId, children] of byParent) {
    byParent.set(parentId, children.sort(compareContentItems));
  }

  const rows: { item: CourseContentItem; depth: number }[] = [];
  const visited = new Set<string>();

  function walk(parentId: string, depth: number) {
    for (const item of byParent.get(parentId) ?? []) {
      if (visited.has(item.id)) {
        continue;
      }
      visited.add(item.id);
      rows.push({ item, depth });
      if (item.kind === "folder" && !collapsedFolderIds.has(item.id)) {
        walk(item.id, depth + 1);
      }
    }
  }

  walk("root", 0);

  for (const item of [...contentItems].sort(compareContentItems)) {
    const parentIsMissing = item.parentId && !itemIds.has(item.parentId);
    if (!visited.has(item.id) && parentIsMissing) {
      rows.push({ item, depth: 0 });
    }
  }

  return rows;
}

function formatFolderOptionLabel(folder: CourseContentItem, depth: number, fallbackTitle: string) {
  const title = folder.titleSnapshot ?? fallbackTitle;
  return depth > 0 ? `${"  ".repeat(depth)}- ${title}` : title;
}

function flattenContentItemsFromParent(
  contentItems: CourseContentItem[],
  parentId: string,
  collapsedFolderIds: Set<string>,
  startingDepth: number
) {
  const byParent = new Map<string, CourseContentItem[]>();
  for (const item of contentItems) {
    const itemParentId = item.parentId ?? "root";
    byParent.set(itemParentId, [...(byParent.get(itemParentId) ?? []), item]);
  }

  for (const [itemParentId, children] of byParent) {
    byParent.set(itemParentId, children.sort(compareContentItems));
  }

  const rows: { item: CourseContentItem; depth: number }[] = [];
  const visited = new Set<string>();

  function walk(currentParentId: string, depth: number) {
    for (const item of byParent.get(currentParentId) ?? []) {
      if (visited.has(item.id)) {
        continue;
      }
      visited.add(item.id);
      rows.push({ item, depth });
      if (item.kind === "folder" && !collapsedFolderIds.has(item.id)) {
        walk(item.id, depth + 1);
      }
    }
  }

  walk(parentId, startingDepth);
  return rows;
}

function isContentDescendant(contentItems: CourseContentItem[], possibleChildId: string, possibleAncestorId: string) {
  const byId = new Map(contentItems.map((item) => [item.id, item]));
  let current = byId.get(possibleChildId);

  while (current?.parentId) {
    if (current.parentId === possibleAncestorId) {
      return true;
    }
    current = byId.get(current.parentId);
  }

  return false;
}

function ActivityContentIcon() {
  return (
    <span className="activity-type-icon activity-content-icon" aria-hidden="true">
      <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 32 32" width="28">
        <path d="M9 6h14l3 3v17H6V6h3z" />
        <path d="M22 6v5h5" />
        <path d="M11 15h10" />
        <path d="M11 20h7" />
        <path d="M11 25h5" />
      </svg>
    </span>
  );
}

function FolderContentIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="activity-type-icon folder-content-icon" aria-hidden="true">
      <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 32 32" width="28">
        <path d="M4 9h9l3 4h12v13H4z" />
        <path d="M4 9v17" />
        <path d={collapsed ? "m18 17 4 3-4 3" : "m18 18 3 4 3-4"} />
      </svg>
    </span>
  );
}

function MaterialActionIcon({
  name
}: {
  name: "activityAdd" | "close" | "download" | "down" | "drag" | "edit" | "hidden" | "open" | "remove" | "save" | "up" | "visible";
}) {
  const paths = {
    activityAdd: (
      <>
        <path d="M6 4h9l3 3v13H6z" />
        <path d="M15 4v4h4" />
        <path d="M10 12h5" />
        <path d="M12.5 9.5v5" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v10" />
        <path d="m8 9 4 4 4-4" />
        <path d="M5 19h14" />
      </>
    ),
    down: (
      <>
        <path d="M12 5v14" />
        <path d="m17 14-5 5-5-5" />
      </>
    ),
    drag: (
      <>
        <path d="M9 5h.01" />
        <path d="M15 5h.01" />
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
        <path d="M9 19h.01" />
        <path d="M15 19h.01" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    hidden: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
        <path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c5 0 9.3 3 10 7-.3 1.5-1.2 2.8-2.4 3.9" />
        <path d="M6.6 6.7C4.5 8 3.2 9.8 2 12c.8 1.6 1.9 3 3.3 4.1" />
      </>
    ),
    open: (
      <>
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </>
    ),
    remove: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h11l3 3v15H5z" />
        <path d="M8 3v6h8" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    up: (
      <>
        <path d="M12 19V5" />
        <path d="m7 10 5-5 5 5" />
      </>
    ),
    visible: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )
  } as const;

  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
      {paths[name]}
    </svg>
  );
}
