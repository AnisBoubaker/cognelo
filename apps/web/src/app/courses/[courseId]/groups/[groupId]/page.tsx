"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FocusEvent, FormEvent, PointerEvent, useEffect, useState } from "react";
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
  CourseMaterial,
  GradebookStatus,
  GroupParticipant,
  GroupParticipantCandidate,
  StudentGradeFeedback,
  StudentReleasedGrades
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function CourseGroupPage() {
  const params = useParams<{ courseId: string; groupId: string }>();
  const { courseId, groupId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [group, setGroup] = useState<CourseGroup | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [studentGrades, setStudentGrades] = useState<StudentReleasedGrades | null>(null);
  const [gradebookActivityId, setGradebookActivityId] = useState("");
  const [gradebookStatus, setGradebookStatus] = useState<GradebookStatus>("all");
  const [savingReleaseItemId, setSavingReleaseItemId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupStatus, setGroupStatus] = useState<"draft" | "published">("draft");
  const [groupAvailableFrom, setGroupAvailableFrom] = useState("");
  const [groupAvailableUntil, setGroupAvailableUntil] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [isAddingGroupMaterial, setIsAddingGroupMaterial] = useState(false);
  const [groupMaterialMode, setGroupMaterialMode] = useState<"folder" | "github_repo" | "file">("github_repo");
  const [groupMaterialTitle, setGroupMaterialTitle] = useState("");
  const [groupMaterialParentId, setGroupMaterialParentId] = useState("");
  const [groupGithubUrl, setGroupGithubUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMaterialTitle, setEditMaterialTitle] = useState("");
  const [editMaterialUrl, setEditMaterialUrl] = useState("");
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ title: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; type: "material" | "root" } | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [collapsedCourseFolderIds, setCollapsedCourseFolderIds] = useState<Set<string>>(new Set());
  const [assignActivityId, setAssignActivityId] = useState("");
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
  const [savingCourseMaterialVisibilityId, setSavingCourseMaterialVisibilityId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [materialError, setMaterialError] = useState("");
  const [materialActionError, setMaterialActionError] = useState("");
  const [courseMaterialVisibilityError, setCourseMaterialVisibilityError] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";

  async function refresh() {
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
      const gradesResult = await api.studentGroupGrades(courseId, groupId);
      setStudentGrades(gradesResult.grades);
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
  const folders = materials.filter((material) => material.kind === "folder").sort(compareMaterials);
  const visibleMaterials = flattenMaterials(materials, collapsedFolderIds);
  const courseMaterials = course?.materials ?? [];
  const hiddenCourseMaterialIds = new Set(group?.hiddenCourseMaterialIds ?? []);
  const visibleCourseMaterials = flattenMaterials(courseMaterials, collapsedCourseFolderIds);
  const displayedCourseMaterials = canManage
    ? visibleCourseMaterials
    : visibleCourseMaterials.filter(({ material }) => !getHiddenMaterialState(courseMaterials, hiddenCourseMaterialIds, material.id).effectivelyHidden);
  const assignedActivities = group?.activities ?? [];
  const releasedGradeByActivityId = new Map(
    (studentGrades?.rows ?? [])
      .filter((row) => row.score !== null)
      .map((row) => [row.activityId, row])
  );
  const participants = group?.participants ?? [];
  const assignableActivities = (course?.activities ?? []).filter(
    (activity) => !assignedActivities.some((assignment) => assignment.activityId === activity.id)
  );
  const gradebookActivities = buildGroupGradebookActivitySummaries(gradebook?.items ?? [], gradebook?.rows ?? []);
  const gradebookOverview = buildGroupGradebookOverview(gradebookActivities);

  useEffect(() => {
    if (!assignActivityId && assignableActivities[0]?.id) {
      setAssignActivityId(assignableActivities[0].id);
    }
  }, [assignActivityId, assignableActivities]);

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
            initialTab="activities"
            tabs={[
              {
                id: "activities",
                label: t("groupPage.activitiesTab"),
                render: () => (
                  <section className="section stack">
                    <div>
                      <p className="eyebrow">{t("groupPage.assignedActivitiesEyebrow")}</p>
                      <h2>{t("groupPage.assignedActivitiesTitle")}</h2>
                      <p className="muted">{t("groupPage.assignedActivitiesText")}</p>
                    </div>

                    {assignedActivities.length ? (
                      <div className="stack" style={{ gap: 10 }}>
                        {assignedActivities.map((assignment) => {
                          const releasedGrade = releasedGradeByActivityId.get(assignment.activity.id);

                          return (
                            <button
                              key={assignment.id}
                              type="button"
                              style={{
                                background: "rgba(255, 255, 255, 0.92)",
                                border: "1px solid rgba(13, 27, 71, 0.08)",
                                borderRadius: 12,
                                color: "inherit",
                                cursor: "pointer",
                                display: "block",
                                padding: "10px 12px",
                                textAlign: "left",
                                width: "100%"
                              }}
                              onClick={() => router.push(`/courses/${courseId}/groups/${groupId}/activities/assigned/${assignment.activity.id}`)}
                            >
                              <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between", width: "100%" }}>
                                <div style={{ minWidth: 0, textAlign: "left" }}>
                                  <strong style={{ display: "block" }}>{assignment.activity.title}</strong>
                                  <span className="table-meta-note muted">
                                    {formatAvailabilityWindow(assignment.availableFrom, assignment.availableUntil, t)}
                                  </span>
                                </div>
                                {releasedGrade ? (
                                  <span className={`participant-status is-${releasedGrade.status.replace("_", "-")}`}>
                                    {t("courseDetail.gradeHeader")}: {formatGradebookScore(releasedGrade.score, releasedGrade.maxScore)}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">{t("groupPage.noAssignedActivities")}</p>
                    )}
                  </section>
                )
              },
              {
                id: "materials",
                label: t("groupPage.materialsTab"),
                render: () => (
                  <section className="section stack">
                    <div>
                      <p className="eyebrow">{t("groupPage.inheritedMaterialsEyebrow")}</p>
                      <h2>{t("groupPage.inheritedMaterialsTitle")}</h2>
                      <p className="muted">{t("groupPage.inheritedMaterialsText")}</p>
                    </div>

                    {displayedCourseMaterials.length ? (
                      <div className="table-list">
                        {displayedCourseMaterials.map(({ material, depth }) => {
                          const href = courseMaterialHref(material);
                          const isCollapsed = collapsedCourseFolderIds.has(material.id);

                          return (
                            <div key={material.id} className="table-row">
                              <div className="table-main material-title" style={{ paddingLeft: `${depth * 22}px` }}>
                                {material.kind === "folder" ? (
                                  <button
                                    aria-expanded={!isCollapsed}
                                    aria-label={t(isCollapsed ? "courseDetail.expandFolder" : "courseDetail.collapseFolder", {
                                      title: material.title
                                    })}
                                    className="material-glyph"
                                    title={t(isCollapsed ? "courseDetail.expandFolderTitle" : "courseDetail.collapseFolderTitle")}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleCourseFolder(material.id);
                                    }}
                                  >
                                    {isCollapsed ? "[+]" : "[-]"}
                                  </button>
                                ) : (
                                  <span className="material-glyph material-glyph-static">-</span>
                                )}
                                <strong>{material.title}</strong>
                              </div>
                              <span className="table-meta muted">{courseMaterialDetail(material)}</span>
                              <div className="table-actions">
                                {href ? (
                                  <a
                                    aria-label={t(
                                      material.kind === "file" ? "courseDetail.downloadMaterial" : "courseDetail.openMaterial",
                                      { title: material.title }
                                    )}
                                    className="button secondary icon-button"
                                    href={href}
                                    rel={material.kind === "file" ? undefined : "noreferrer"}
                                    target={material.kind === "file" ? undefined : "_blank"}
                                    title={t(material.kind === "file" ? "common.download" : "common.open")}
                                  >
                                    <MaterialActionIcon name={material.kind === "file" ? "download" : "open"} />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">{t("groupPage.noCourseMaterials")}</p>
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

  function nextMaterialPosition(parentId: string | null) {
    return materials.filter((material) => (material.parentId ?? null) === parentId).length;
  }

  function groupMaterialHref(material: CourseGroupMaterial) {
    if (material.kind === "file") {
      return api.groupMaterialDownloadUrl(courseId, groupId, material.id);
    }
    return material.url ?? undefined;
  }

  function materialDetail(material: CourseGroupMaterial) {
    const originalName = typeof material.metadata?.originalName === "string" ? material.metadata.originalName : undefined;
    const size = typeof material.metadata?.size === "number" ? formatBytes(material.metadata.size) : undefined;
    if (originalName && size) {
      return `${originalName} · ${size}`;
    }
    return originalName || material.url || material.body || t("courseDetail.metadataOnly");
  }

  function courseMaterialHref(material: CourseMaterial) {
    if (material.kind === "file") {
      return api.groupCourseMaterialDownloadUrl(courseId, groupId, material.id);
    }
    return material.url ?? undefined;
  }

  function courseMaterialDetail(material: CourseMaterial) {
    const originalName = typeof material.metadata?.originalName === "string" ? material.metadata.originalName : undefined;
    const size = typeof material.metadata?.size === "number" ? formatBytes(material.metadata.size) : undefined;
    if (originalName && size) {
      return `${originalName} · ${size}`;
    }
    return originalName || material.url || material.body || t("courseDetail.metadataOnly");
  }

  function resetGroupMaterialForm() {
    setGroupMaterialMode("github_repo");
    setGroupMaterialTitle("");
    setGroupMaterialParentId("");
    setGroupGithubUrl("");
    setSelectedFile(null);
    setMaterialError("");
  }

  function closeGroupMaterialForm() {
    resetGroupMaterialForm();
    setIsAddingGroupMaterial(false);
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

  async function createGroupMaterial(event: FormEvent) {
    event.preventDefault();
    setMaterialError("");

    try {
      const parentId = groupMaterialParentId || null;
      const position = nextMaterialPosition(parentId);

      if (groupMaterialMode === "folder") {
        await api.createGroupMaterial(courseId, groupId, {
          title: groupMaterialTitle || t("courseDetail.defaultFolderTitle"),
          kind: "folder",
          parentId,
          metadata: {},
          position
        });
      } else if (groupMaterialMode === "github_repo") {
        await api.createGroupMaterial(courseId, groupId, {
          title: groupMaterialTitle || t("courseDetail.defaultRepoTitle"),
          kind: "github_repo",
          parentId,
          url: groupGithubUrl,
          metadata: { source: "github" },
          position
        });
      } else {
        if (!selectedFile) {
          setMaterialError(t("courseDetail.chooseFile"));
          return;
        }
        await api.uploadGroupMaterial(courseId, groupId, {
          title: groupMaterialTitle || selectedFile.name,
          file: selectedFile,
          parentId,
          position
        });
      }

      await refresh();
      closeGroupMaterialForm();
    } catch (err) {
      setMaterialError(err instanceof Error ? err.message : t("groupPage.materialCreateError"));
    }
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

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  function startEditingMaterial(material: CourseGroupMaterial) {
    setMaterialActionError("");
    setEditingMaterialId(material.id);
    setEditMaterialTitle(material.title);
    setEditMaterialUrl(material.url ?? "");
  }

  async function saveMaterialEdit(material: CourseGroupMaterial) {
    setMaterialActionError("");
    try {
      await api.updateGroupMaterial(courseId, groupId, material.id, {
        kind: material.kind,
        title: editMaterialTitle,
        url: material.kind === "github_repo" ? editMaterialUrl : undefined
      });
      setEditingMaterialId(null);
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("groupPage.materialUpdateError"));
    }
  }

  async function removeMaterial(material: CourseGroupMaterial) {
    const confirmed = window.confirm(t("groupPage.removeMaterialConfirm", { title: material.title }));
    if (!confirmed) {
      return;
    }

    setMaterialActionError("");
    try {
      await api.deleteGroupMaterial(courseId, groupId, material.id);
      if (editingMaterialId === material.id) {
        setEditingMaterialId(null);
      }
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("groupPage.materialDeleteError"));
    }
  }

  async function moveMaterialAfterTarget(dragged: CourseGroupMaterial, target: CourseGroupMaterial) {
    const nextParentId = target.parentId ?? null;
    const siblings = materials
      .filter((material) => material.id !== dragged.id && (material.parentId ?? null) === nextParentId)
      .sort(compareMaterials);
    const targetIndex = siblings.findIndex((material) => material.id === target.id);
    siblings.splice(targetIndex + 1, 0, { ...dragged, parentId: nextParentId });

    await Promise.all(
      siblings.map((material, index) =>
        api.updateGroupMaterial(courseId, groupId, material.id, {
          parentId: nextParentId,
          position: index
        })
      )
    );
  }

  async function moveMaterialIntoFolder(dragged: CourseGroupMaterial, folder: CourseGroupMaterial) {
    await api.updateGroupMaterial(courseId, groupId, dragged.id, {
      parentId: folder.id,
      position: nextMaterialPosition(folder.id)
    });
  }

  async function moveMaterialToRoot(dragged: CourseGroupMaterial) {
    await api.updateGroupMaterial(courseId, groupId, dragged.id, {
      parentId: null,
      position: nextMaterialPosition(null)
    });
  }

  async function moveMaterialSafely(action: () => Promise<void>) {
    try {
      await action();
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.moveError"));
    }
  }

  function handleMaterialPointerDown(material: CourseGroupMaterial, event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    setDraggingMaterialId(material.id);
    setDragPreview({ title: material.title, x: event.clientX, y: event.clientY });

    const movePreview = (moveEvent: globalThis.PointerEvent) => {
      setDragPreview((current) => (current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current));
      setDropTarget(findDropTarget(moveEvent.clientX, moveEvent.clientY, material.id));
    };

    const finishDrag = async (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("pointermove", movePreview);
      const dropElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      setDraggingMaterialId(null);
      setDragPreview(null);
      setDropTarget(null);

      if (dropElement?.closest("[data-root-drop='true']")) {
        if (!material.parentId) {
          return;
        }
        await moveMaterialSafely(() => moveMaterialToRoot(material));
        return;
      }

      const targetElement = dropElement?.closest("[data-material-id]");
      if (!(targetElement instanceof HTMLElement)) {
        return;
      }

      const target = materials.find((candidate) => candidate.id === targetElement.dataset.materialId);
      if (!target || target.id === material.id) {
        return;
      }

      await moveMaterialSafely(async () => {
        if (target.kind === "folder") {
          if (isMaterialDescendant(materials, target.id, material.id)) {
            setMaterialActionError(t("courseDetail.invalidFolderMove"));
            return;
          }
          await moveMaterialIntoFolder(material, target);
        } else {
          await moveMaterialAfterTarget(material, target);
        }
      });
    };

    const cancelDrag = () => {
      setDraggingMaterialId(null);
      setDragPreview(null);
      setDropTarget(null);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointermove", movePreview);
    };

    window.addEventListener("pointermove", movePreview);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", cancelDrag, { once: true });
  }

  function findDropTarget(x: number, y: number, draggedId: string) {
    const element = document.elementFromPoint(x, y);
    if (element?.closest("[data-root-drop='true']")) {
      return { id: "root", type: "root" as const };
    }

    const materialElement = element?.closest("[data-material-id]");
    if (!(materialElement instanceof HTMLElement)) {
      return null;
    }

    const targetId = materialElement.dataset.materialId;
    if (!targetId || targetId === draggedId) {
      return null;
    }

    return { id: targetId, type: "material" as const };
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function toggleCourseFolder(folderId: string) {
    setCollapsedCourseFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  async function toggleCourseMaterialVisibility(material: CourseMaterial) {
    if (!canManage) {
      return;
    }

    const hiddenState = getHiddenMaterialState(courseMaterials, hiddenCourseMaterialIds, material.id);
    if (hiddenState.hiddenByAncestor && !hiddenState.directlyHidden) {
      return;
    }

    setCourseMaterialVisibilityError("");
    setSavingCourseMaterialVisibilityId(material.id);
    try {
      if (hiddenState.directlyHidden) {
        await api.unhideCourseMaterialInGroup(courseId, groupId, material.id);
      } else {
        await api.hideCourseMaterialInGroup(courseId, groupId, material.id);
      }
      await refresh();
    } catch (err) {
      setCourseMaterialVisibilityError(err instanceof Error ? err.message : t("groupPage.courseMaterialVisibilityError"));
    } finally {
      setSavingCourseMaterialVisibilityId(null);
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

    try {
      await api.assignGroupActivity(courseId, groupId, {
        activityId: assignActivityId,
        availableFrom: toIsoOrNull(assignAvailableFrom),
        availableUntil: toIsoOrNull(assignAvailableUntil),
        config: {},
        metadata: { assessmentMode: assignAssessmentMode },
        ...(assignAssessmentMode === "summative" ? { gradebookSettings: buildAssignGradebookSettings() } : {}),
        position: assignedActivities.length
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
      const remaining = assignableActivities.filter((activity) => activity.id !== assignActivityId);
      setAssignActivityId(remaining[0]?.id ?? "");
      setIsAssigningActivity(false);
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : t("groupPage.assignmentCreateError"));
    }
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
              initialTab={searchParams.get("tab") === "gradebook" ? "gradebook" : "activities"}
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
                          <button className="secondary" type="button" onClick={() => setIsAssigningActivity((current) => !current)}>
                            {isAssigningActivity ? t("common.cancel") : t("groupPage.assignActivityTitle")}
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
                                onChange={(event) => setAssignActivityId(event.target.value)}
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
                                value={assignAssessmentMode}
                                onChange={(event) => setAssignAssessmentMode(event.target.value as "formative" | "summative")}
                                disabled={!canManage}
                              >
                                <option value="formative">{t("groupPage.assessmentModeFormative")}</option>
                                <option value="summative">{t("groupPage.assessmentModeSummative")}</option>
                              </select>
                            </div>
                            {assignAssessmentMode === "summative" ? (
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
                  id: "materials",
                  label: t("groupPage.materialsTab"),
                  render: () => (
                    <div className="stack">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{t("groupPage.materialsEyebrow")}</p>
                      <h2>{t("groupPage.materialsTitle")}</h2>
                      <p className="muted">{t("groupPage.materialsText")}</p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          if (isAddingGroupMaterial) {
                            closeGroupMaterialForm();
                            return;
                          }
                          setMaterialError("");
                          setIsAddingGroupMaterial(true);
                        }}
                      >
                        {isAddingGroupMaterial ? t("common.cancel") : t("courseDetail.addMaterial")}
                      </button>
                    ) : null}
                  </div>

                  {canManage && isAddingGroupMaterial ? (
                    <form className="form inline-panel" onSubmit={createGroupMaterial}>
                      <div className="field">
                        <label htmlFor="groupMaterialMode">{t("courseDetail.source")}</label>
                        <select
                          id="groupMaterialMode"
                          value={groupMaterialMode}
                          onChange={(event) => setGroupMaterialMode(event.target.value as typeof groupMaterialMode)}
                        >
                          <option value="folder">{t("materialKinds.folder")}</option>
                          <option value="github_repo">{t("materialKinds.github_repo")}</option>
                          <option value="file">{t("materialKinds.file")}</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="groupMaterialParent">{t("courseDetail.location")}</label>
                        <select
                          id="groupMaterialParent"
                          value={groupMaterialParentId}
                          onChange={(event) => setGroupMaterialParentId(event.target.value)}
                        >
                          <option value="">{t("courseDetail.topLevel")}</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="groupMaterialTitle">{t("courseDetail.activityTitle")}</label>
                        <input
                          id="groupMaterialTitle"
                          value={groupMaterialTitle}
                          onChange={(event) => setGroupMaterialTitle(event.target.value)}
                          placeholder={
                            groupMaterialMode === "file"
                              ? t("courseDetail.fileTitlePlaceholder")
                              : groupMaterialMode === "folder"
                                ? t("courseDetail.folderTitlePlaceholder")
                                : t("courseDetail.repoTitlePlaceholder")
                          }
                        />
                      </div>
                      {groupMaterialMode === "folder" ? null : groupMaterialMode === "github_repo" ? (
                        <div className="field" key="group-github-repo-material">
                          <label htmlFor="groupGithubUrl">{t("courseDetail.githubUrl")}</label>
                          <input
                            key="groupGithubUrl"
                            id="groupGithubUrl"
                            type="url"
                            value={groupGithubUrl}
                            onChange={(event) => setGroupGithubUrl(event.target.value)}
                            placeholder="https://github.com/org/repo"
                            required
                          />
                        </div>
                      ) : (
                        <div className="field" key="group-file-material">
                          <label htmlFor="groupMaterialFile">{t("courseDetail.file")}</label>
                          <input key="groupMaterialFile" id="groupMaterialFile" type="file" onChange={chooseFile} required />
                          <p className="muted">{t("courseDetail.maxFileSize")}</p>
                        </div>
                      )}
                      {materialError ? <p className="error">{materialError}</p> : null}
                      <div className="row">
                        <button type="submit">{t("groupPage.addMaterial")}</button>
                        <button type="button" className="button secondary" onClick={closeGroupMaterialForm}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {visibleMaterials.length ? (
                    <div className="table-list">
                      <div className="table-row table-head" aria-hidden="true">
                        <span>{t("courseDetail.titleHeader")}</span>
                        <span>{t("courseDetail.typeHeader")}</span>
                        <span>{t("courseDetail.sourceHeader")}</span>
                        <span>{t("courseDetail.actionsHeader")}</span>
                      </div>
                      <div
                        className={`root-drop-zone ${draggingMaterialId ? "is-active" : ""} ${
                          dropTarget?.type === "root" ? "is-drop-target" : ""
                        }`}
                        data-root-drop="true"
                      >
                        {t("courseDetail.moveToTopLevel")}
                      </div>
                      {visibleMaterials.map(({ material, depth }) => {
                        const href = groupMaterialHref(material);
                        const isEditing = editingMaterialId === material.id;
                        const isCollapsed = collapsedFolderIds.has(material.id);
                        return (
                          <div key={material.id}>
                            <div
                              className={`table-row ${draggingMaterialId === material.id ? "is-dragging" : ""} ${
                                dropTarget?.type === "material" && dropTarget.id === material.id ? "is-drop-target" : ""
                              }`}
                              data-material-id={material.id}
                            >
                              <div className="table-main material-title" style={{ paddingLeft: `${depth * 22}px` }}>
                                {canManage ? (
                                  <span
                                    aria-label={t("courseDetail.dragMaterial", { title: material.title })}
                                    className="drag-handle"
                                    role="button"
                                    tabIndex={0}
                                    title={t("courseDetail.dragToMove")}
                                    onPointerDown={(event) => handleMaterialPointerDown(material, event)}
                                  >
                                    <MaterialActionIcon name="drag" />
                                  </span>
                                ) : null}
                                {material.kind === "folder" ? (
                                  <button
                                    aria-expanded={!isCollapsed}
                                    aria-label={t(isCollapsed ? "courseDetail.expandFolder" : "courseDetail.collapseFolder", {
                                      title: material.title
                                    })}
                                    className="material-glyph"
                                    title={t(isCollapsed ? "courseDetail.expandFolderTitle" : "courseDetail.collapseFolderTitle")}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleFolder(material.id);
                                    }}
                                  >
                                    {isCollapsed ? "[+]" : "[-]"}
                                  </button>
                                ) : (
                                  <span className="material-glyph material-glyph-static">-</span>
                                )}
                                <strong>{material.title}</strong>
                              </div>
                              <span className="eyebrow">{t(`materialKinds.${material.kind}`)}</span>
                              <span className="table-meta muted">{materialDetail(material)}</span>
                              <div className="table-actions">
                                {href ? (
                                  <a
                                    aria-label={t(
                                      material.kind === "file" ? "courseDetail.downloadMaterial" : "courseDetail.openMaterial",
                                      { title: material.title }
                                    )}
                                    className="button secondary icon-button"
                                    href={href}
                                    rel={material.kind === "file" ? undefined : "noreferrer"}
                                    target={material.kind === "file" ? undefined : "_blank"}
                                    title={t(material.kind === "file" ? "common.download" : "common.open")}
                                  >
                                    <MaterialActionIcon name={material.kind === "file" ? "download" : "open"} />
                                  </a>
                                ) : null}
                                {canManage ? (
                                  <>
                                    <button
                                      aria-label={t("courseDetail.editMaterial", { title: material.title })}
                                      className="secondary icon-button"
                                      title={t("common.edit")}
                                      type="button"
                                      onClick={() => startEditingMaterial(material)}
                                    >
                                      <MaterialActionIcon name="edit" />
                                    </button>
                                    <button
                                      aria-label={t("courseDetail.removeMaterial", { title: material.title })}
                                      className="danger icon-button"
                                      title={t("common.remove")}
                                      type="button"
                                      onClick={() => removeMaterial(material)}
                                    >
                                      <MaterialActionIcon name="remove" />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            {isEditing ? (
                              <form
                                className="inline-edit"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void saveMaterialEdit(material);
                                }}
                              >
                                <div className="field">
                                  <label htmlFor={`group-edit-title-${material.id}`}>{t("courseDetail.activityTitle")}</label>
                                  <input
                                    id={`group-edit-title-${material.id}`}
                                    value={editMaterialTitle}
                                    onChange={(event) => setEditMaterialTitle(event.target.value)}
                                    required
                                    minLength={2}
                                  />
                                </div>
                                {material.kind === "github_repo" ? (
                                  <div className="field">
                                    <label htmlFor={`group-edit-url-${material.id}`}>{t("courseDetail.githubEditLabel")}</label>
                                    <input
                                      id={`group-edit-url-${material.id}`}
                                      type="url"
                                      value={editMaterialUrl}
                                      onChange={(event) => setEditMaterialUrl(event.target.value)}
                                      required
                                    />
                                  </div>
                                ) : null}
                                <div className="row">
                                  <button type="submit">{t("courseDetail.saveMaterial")}</button>
                                  <button className="secondary" type="button" onClick={() => setEditingMaterialId(null)}>
                                    {t("common.cancel")}
                                  </button>
                                </div>
                              </form>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">{t("groupPage.noMaterials")}</p>
                  )}
                  {materialActionError ? <p className="error">{materialActionError}</p> : null}

                  <section className="section stack">
                    <div>
                      <p className="eyebrow">{t("groupPage.inheritedMaterialsEyebrow")}</p>
                      <h2>{t("groupPage.inheritedMaterialsTitle")}</h2>
                      <p className="muted">{t("groupPage.inheritedMaterialsText")}</p>
                    </div>

                    {displayedCourseMaterials.length ? (
                      <div className="table-list">
                        <div className="table-row table-head" aria-hidden="true">
                          <span>{t("courseDetail.titleHeader")}</span>
                          <span>{t("courseDetail.typeHeader")}</span>
                          <span>{t("courseDetail.sourceHeader")}</span>
                          <span>{t("courseDetail.actionsHeader")}</span>
                        </div>
                        {displayedCourseMaterials.map(({ material, depth }) => {
                          const href = courseMaterialHref(material);
                          const hiddenState = getHiddenMaterialState(courseMaterials, hiddenCourseMaterialIds, material.id);
                          const isCollapsed = collapsedCourseFolderIds.has(material.id);

                          return (
                            <div
                              key={material.id}
                              className={`table-row ${hiddenState.effectivelyHidden ? "is-hidden-material" : ""}`}
                            >
                              <div className="table-main material-title" style={{ paddingLeft: `${depth * 22}px` }}>
                                {material.kind === "folder" ? (
                                  <button
                                    aria-expanded={!isCollapsed}
                                    aria-label={t(isCollapsed ? "courseDetail.expandFolder" : "courseDetail.collapseFolder", {
                                      title: material.title
                                    })}
                                    className="material-glyph"
                                    title={t(isCollapsed ? "courseDetail.expandFolderTitle" : "courseDetail.collapseFolderTitle")}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleCourseFolder(material.id);
                                    }}
                                  >
                                    {isCollapsed ? "[+]" : "[-]"}
                                  </button>
                                ) : (
                                  <span className="material-glyph material-glyph-static">-</span>
                                )}
                                <strong>{material.title}</strong>
                              </div>
                              <span className="eyebrow">{t(`materialKinds.${material.kind}`)}</span>
                              <span className="table-meta muted">
                                {courseMaterialDetail(material)}
                                {hiddenState.effectivelyHidden ? (
                                  <span className="table-meta-note">
                                    {hiddenState.hiddenByAncestor && !hiddenState.directlyHidden
                                      ? t("groupPage.hiddenByFolder")
                                      : t("groupPage.hiddenInGroup")}
                                  </span>
                                ) : null}
                              </span>
                              <div className="table-actions">
                                {href ? (
                                  <a
                                    aria-label={t(
                                      material.kind === "file" ? "courseDetail.downloadMaterial" : "courseDetail.openMaterial",
                                      { title: material.title }
                                    )}
                                    className="button secondary icon-button"
                                    href={href}
                                    rel={material.kind === "file" ? undefined : "noreferrer"}
                                    target={material.kind === "file" ? undefined : "_blank"}
                                    title={t(material.kind === "file" ? "common.download" : "common.open")}
                                  >
                                    <MaterialActionIcon name={material.kind === "file" ? "download" : "open"} />
                                  </a>
                                ) : null}
                                {canManage ? (
                                  <button
                                    aria-label={t(
                                      hiddenState.directlyHidden ? "groupPage.unhideCourseMaterial" : "groupPage.hideCourseMaterial",
                                      { title: material.title }
                                    )}
                                    className="secondary icon-button"
                                    disabled={
                                      savingCourseMaterialVisibilityId === material.id ||
                                      (hiddenState.hiddenByAncestor && !hiddenState.directlyHidden)
                                    }
                                    title={
                                      hiddenState.hiddenByAncestor && !hiddenState.directlyHidden
                                        ? t("groupPage.hiddenByFolder")
                                        : t(hiddenState.directlyHidden ? "groupPage.unhideAction" : "groupPage.hideAction")
                                    }
                                    type="button"
                                    onClick={() => void toggleCourseMaterialVisibility(material)}
                                  >
                                    <MaterialActionIcon name={hiddenState.effectivelyHidden ? "hidden" : "visible"} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">{t("groupPage.noCourseMaterials")}</p>
                    )}
                    {courseMaterialVisibilityError ? <p className="error">{courseMaterialVisibilityError}</p> : null}
                  </section>
                    </div>
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
              ]}
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

  return (
    <div className="stack stack-tight">
      {feedback.feedbackText ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          <p className="muted">{feedback.feedbackText}</p>
        </div>
      ) : null}
      {feedback.messages.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.feedbackTitle")}</strong>
          {feedback.messages.map((message) => (
            <p className="muted" key={message.type}>
              {message.type === "order"
                ? t("parsons.orderFeedback", { count: message.count })
                : t("parsons.indentFeedback", { count: message.count })}
            </p>
          ))}
        </div>
      ) : null}
      {feedback.grading.length ? (
        <div className="stack stack-tight">
          <strong>{t("groupPage.gradingBreakdownTitle")}</strong>
          {scaleFeedbackGrading(feedback, maxScore).map((component) => (
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

function scaleFeedbackGrading(feedback: StudentGradeFeedback, maxScore: number) {
  const rawTotal = feedback.grading.reduce((sum, component) => sum + component.possibleRaw, 0);
  const scale = rawTotal > 0 ? maxScore / rawTotal : 1;
  return feedback.grading.map((component) => ({
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

type MaterialTreeNode = {
  id: string;
  title: string;
  kind: string;
  parentId?: string | null;
  position: number;
};

function compareMaterials<T extends MaterialTreeNode>(left: T, right: T) {
  return left.position - right.position || left.title.localeCompare(right.title);
}

function flattenMaterials<T extends MaterialTreeNode>(materials: T[], collapsedFolderIds: Set<string>) {
  const materialIds = new Set(materials.map((material) => material.id));
  const byParent = new Map<string, T[]>();
  for (const material of materials) {
    const parentId = material.parentId ?? "root";
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), material]);
  }

  for (const [parentId, children] of byParent) {
    byParent.set(parentId, children.sort(compareMaterials));
  }

  const rows: { material: T; depth: number }[] = [];
  const visited = new Set<string>();

  function walk(parentId: string, depth: number) {
    for (const material of byParent.get(parentId) ?? []) {
      if (visited.has(material.id)) {
        continue;
      }
      visited.add(material.id);
      rows.push({ material, depth });
      if (material.kind === "folder" && !collapsedFolderIds.has(material.id)) {
        walk(material.id, depth + 1);
      }
    }
  }

  walk("root", 0);

  for (const material of materials.sort(compareMaterials)) {
    const parentIsMissing = material.parentId && !materialIds.has(material.parentId);
    if (!visited.has(material.id) && parentIsMissing) {
      rows.push({ material, depth: 0 });
    }
  }

  return rows;
}

function isMaterialDescendant<T extends MaterialTreeNode>(materials: T[], possibleChildId: string, possibleAncestorId: string) {
  const byId = new Map(materials.map((material) => [material.id, material]));
  let current = byId.get(possibleChildId);

  while (current?.parentId) {
    if (current.parentId === possibleAncestorId) {
      return true;
    }
    current = byId.get(current.parentId);
  }

  return false;
}

function getHiddenMaterialState<T extends MaterialTreeNode>(materials: T[], hiddenMaterialIds: Set<string>, materialId: string) {
  const byId = new Map(materials.map((material) => [material.id, material]));
  let current = byId.get(materialId);
  let directlyHidden = false;
  let hiddenByAncestor = false;

  while (current) {
    if (hiddenMaterialIds.has(current.id)) {
      if (current.id === materialId) {
        directlyHidden = true;
      } else {
        hiddenByAncestor = true;
      }
      break;
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return {
    directlyHidden,
    hiddenByAncestor,
    effectivelyHidden: directlyHidden || hiddenByAncestor
  };
}

function MaterialActionIcon({ name }: { name: "download" | "drag" | "edit" | "hidden" | "open" | "remove" | "save" | "visible" }) {
  const paths = {
    download: (
      <>
        <path d="M12 3v10" />
        <path d="m8 9 4 4 4-4" />
        <path d="M5 19h14" />
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
