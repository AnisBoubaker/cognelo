"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, PointerEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { api, ActivityBank, ActivityDefinition, ActivityType, AiAgentConnection, Course, CourseGradebook, CourseMaterial, GradebookStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type ActivityCategoryId = "programming" | "miscellaneous";
type ActivityPickerTabId = "activity-banks" | ActivityCategoryId;

const activityCategories: Array<{ id: ActivityCategoryId; labelKey: string }> = [
  { id: "programming", labelKey: "activityBankDetail.categoryProgramming" },
  { id: "miscellaneous", labelKey: "activityBankDetail.categoryMiscellaneous" }
];

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [activityBanks, setActivityBanks] = useState<ActivityBank[]>([]);
  const [aiAgentConnections, setAiAgentConnections] = useState<AiAgentConnection[]>([]);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [gradebookGroupId, setGradebookGroupId] = useState("");
  const [gradebookActivityId, setGradebookActivityId] = useState("");
  const [gradebookStatus, setGradebookStatus] = useState<GradebookStatus>("all");
  const [studentSupportAgentId, setStudentSupportAgentId] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [selectedActivityPickerTab, setSelectedActivityPickerTab] = useState<ActivityPickerTabId>("activity-banks");
  const [selectedActivityBankId, setSelectedActivityBankId] = useState("");
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [assignAllActivityId, setAssignAllActivityId] = useState<string | null>(null);
  const [assignAllAvailableFrom, setAssignAllAvailableFrom] = useState("");
  const [assignAllAvailableUntil, setAssignAllAvailableUntil] = useState("");
  const [assignAllEnablePerGroupSettings, setAssignAllEnablePerGroupSettings] = useState(true);
  const [assignAllAssessmentMode, setAssignAllAssessmentMode] = useState<"formative" | "summative">("formative");
  const [assignAllPointsPossible, setAssignAllPointsPossible] = useState("100");
  const [assignAllGradingMode, setAssignAllGradingMode] = useState<"points" | "pass_fail">("points");
  const [assignAllPassThresholdPoints, setAssignAllPassThresholdPoints] = useState("50");
  const [assignAllPassThresholdOutOf, setAssignAllPassThresholdOutOf] = useState("100");
  const [assignAllAttemptLimitMode, setAssignAllAttemptLimitMode] = useState<"unlimited" | "max_attempts" | "until_due">("unlimited");
  const [assignAllMaxAttempts, setAssignAllMaxAttempts] = useState("1");
  const [assignAllGradeStrategy, setAssignAllGradeStrategy] = useState<"latest" | "best" | "first" | "weighted_average">("latest");
  const [assignAllDropLowestAttempt, setAssignAllDropLowestAttempt] = useState(false);
  const [assignAllSavingActivityId, setAssignAllSavingActivityId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [materialMode, setMaterialMode] = useState<"folder" | "github_repo" | "file">("github_repo");
  const [materialTitle, setMaterialTitle] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [materialParentId, setMaterialParentId] = useState("");
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMaterialTitle, setEditMaterialTitle] = useState("");
  const [editMaterialUrl, setEditMaterialUrl] = useState("");
  const [draggingMaterialId, setDraggingMaterialId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ title: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; type: "material" | "root" } | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [materialError, setMaterialError] = useState("");
  const [materialActionError, setMaterialActionError] = useState("");

  async function refresh() {
    const [courseResult, typeResult] = await Promise.all([api.course(courseId), api.activityTypes()]);
    setCourse(courseResult.course);
    setActivityTypes(typeResult.activityTypes);
    setActivityDefinitions(typeResult.registeredDefinitions);
    const role = courseResult.course.memberships?.find((membership) => membership.userId === user?.id)?.role;
    const userCanManage = user?.roles.includes("admin") || role === "owner" || role === "teacher";
    if (userCanManage) {
      const gradebookResult = await api.courseGradebook(courseId, {
        groupId: gradebookGroupId || undefined,
        activityId: gradebookActivityId || undefined,
        status: gradebookStatus
      });
      setGradebook(gradebookResult.gradebook);
    } else {
      setGradebook(null);
    }
    const aiSettings = getCourseAiSettings(courseResult.course);
    setStudentSupportAgentId(aiSettings.studentSupportAiAgentConnectionId);
    api
      .aiAgentConnections()
      .then((aiAgentResult) => setAiAgentConnections(aiAgentResult.connections.filter((connection) => connection.isEnabled)))
      .catch(() => setAiAgentConnections([]));
    if (courseResult.course.subjectId) {
      const banksResult = await api.activityBanks(courseResult.course.subjectId);
      setActivityBanks(banksResult.activityBanks);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [courseId, t, user, gradebookGroupId, gradebookActivityId, gradebookStatus]);

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";

  useEffect(() => {
    if (course && !canManage && course.groups?.[0]?.id) {
      router.replace(`/courses/${courseId}/groups/${course.groups[0].id}`);
    }
  }, [canManage, course, courseId, router]);

  useEffect(() => {
    if (!showActivityPicker) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowActivityPicker(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showActivityPicker]);

  useEffect(() => {
    if (!activityBanks.length) {
      setSelectedActivityBankId("");
      return;
    }

    setSelectedActivityBankId((current) => (activityBanks.some((bank) => bank.id === current) ? current : activityBanks[0].id));
  }, [activityBanks]);

  async function createLocalActivity(selectedActivityTypeKey: string) {
    setError("");
    setIsAddingActivity(true);
    try {
      const selectedActivityCopy = activityCopy(selectedActivityTypeKey);
      const definition = activityDefinitions.find((candidate) => candidate.key === selectedActivityTypeKey);
      const result = await api.createActivity(courseId, {
        title: selectedActivityCopy.defaultTitle || t("courseDetail.defaultActivityTitle"),
        activityTypeKey: selectedActivityTypeKey,
        lifecycle: "draft",
        description: selectedActivityCopy.description,
        config: definition?.defaultConfig ?? {},
        metadata: { researchTags: [] },
        position: course?.activities?.length ?? 0
      });
      setShowActivityPicker(false);
      await refresh();
      router.push(`/courses/${courseId}/activities/${result.activity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.createActivityError"));
    } finally {
      setIsAddingActivity(false);
    }
  }

  async function attachBankActivity(bankActivity: NonNullable<ActivityBank["activities"]>[number]) {
    setError("");
    setIsAddingActivity(true);
    try {
      const result = await api.createActivity(courseId, {
        title: bankActivity.title,
        activityTypeKey: bankActivity.activityType.key,
        bankActivityId: bankActivity.id,
        activityVersionId: bankActivity.currentVersionId ?? undefined,
        lifecycle: "draft",
        description: bankActivity.description,
        config: {},
        metadata: { researchTags: [] },
        position: course?.activities?.length ?? 0
      });
      setShowActivityPicker(false);
      await refresh();
      router.push(`/courses/${courseId}/activities/${result.activity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.createActivityError"));
    } finally {
      setIsAddingActivity(false);
    }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api.createGroup(courseId, {
        title: groupTitle
      });
      await refresh();
      setGroupTitle("");
      setIsAddingGroup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.createGroupError"));
    }
  }

  async function removeActivity(activity: NonNullable<Course["activities"]>[number]) {
    const confirmed = window.confirm(t("courseDetail.removeActivityConfirm", { title: activity.title }));
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await api.deleteActivity(courseId, activity.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.removeActivityError"));
    }
  }

  function startAssigningActivityToAllGroups(activity: NonNullable<Course["activities"]>[number]) {
    const rule = getAllGroupsAssignmentRule(activity);
    const gradebookSettings = rule?.gradebookSettings;
    setAssignAllActivityId(activity.id);
    setAssignAllAvailableFrom(toDateTimeLocalValue(rule?.availableFrom));
    setAssignAllAvailableUntil(toDateTimeLocalValue(rule?.availableUntil));
    setAssignAllEnablePerGroupSettings(rule?.enablePerGroupSettings ?? true);
    setAssignAllAssessmentMode(rule?.assessmentMode ?? "formative");
    setAssignAllPointsPossible(String(gradebookSettings?.pointsPossible ?? 100));
    setAssignAllGradingMode(gradebookSettings?.gradingMode ?? "points");
    setAssignAllPassThresholdPoints(String(gradebookSettings?.passThresholdPoints ?? 50));
    setAssignAllPassThresholdOutOf(String(gradebookSettings?.passThresholdOutOf ?? 100));
    setAssignAllAttemptLimitMode(gradebookSettings?.attemptLimitMode ?? "unlimited");
    setAssignAllMaxAttempts(String(gradebookSettings?.maxAttempts ?? 1));
    setAssignAllGradeStrategy(gradebookSettings?.gradeStrategy ?? "latest");
    setAssignAllDropLowestAttempt(gradebookSettings?.dropLowestAttempt ?? false);
    setError("");
  }

  function buildAssignAllGradebookSettings() {
    const pointsPossible = Number(assignAllPointsPossible);
    const passThresholdPoints = Number(assignAllPassThresholdPoints);
    const passThresholdOutOf = Number(assignAllPassThresholdOutOf);
    const maxAttempts = Number(assignAllMaxAttempts);
    return {
      pointsPossible: Number.isFinite(pointsPossible) && pointsPossible > 0 ? pointsPossible : 100,
      gradingMode: assignAllGradingMode,
      passThresholdPoints:
        assignAllGradingMode === "pass_fail" && Number.isFinite(passThresholdPoints) ? passThresholdPoints : null,
      passThresholdOutOf:
        assignAllGradingMode === "pass_fail" && Number.isFinite(passThresholdOutOf) && passThresholdOutOf > 0 ? passThresholdOutOf : null,
      attemptLimitMode: assignAllAttemptLimitMode,
      maxAttempts: assignAllAttemptLimitMode === "max_attempts" && Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : null,
      gradeStrategy: assignAllGradeStrategy,
      dropLowestAttempt: assignAllGradeStrategy === "weighted_average" ? assignAllDropLowestAttempt : false
    };
  }

  async function assignActivityToAllGroups(event: FormEvent) {
    event.preventDefault();
    if (!assignAllActivityId) {
      return;
    }

    setError("");
    setAssignAllSavingActivityId(assignAllActivityId);
    try {
      await api.assignActivityToAllCourseGroups(courseId, assignAllActivityId, {
        availableFrom: toIsoOrNull(assignAllAvailableFrom),
        availableUntil: toIsoOrNull(assignAllAvailableUntil),
        enablePerGroupSettings: assignAllEnablePerGroupSettings,
        assessmentMode: assignAllAssessmentMode,
        ...(assignAllAssessmentMode === "summative" ? { gradebookSettings: buildAssignAllGradebookSettings() } : {})
      });
      setAssignAllActivityId(null);
      setAssignAllAvailableFrom("");
      setAssignAllAvailableUntil("");
      setAssignAllEnablePerGroupSettings(true);
      setAssignAllAssessmentMode("formative");
      setAssignAllPointsPossible("100");
      setAssignAllGradingMode("points");
      setAssignAllPassThresholdPoints("50");
      setAssignAllPassThresholdOutOf("100");
      setAssignAllAttemptLimitMode("unlimited");
      setAssignAllMaxAttempts("1");
      setAssignAllGradeStrategy("latest");
      setAssignAllDropLowestAttempt(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.assignAllGroupsError"));
    } finally {
      setAssignAllSavingActivityId(null);
    }
  }

  async function removeActivityFromAllGroupsPolicy(activity: NonNullable<Course["activities"]>[number]) {
    const confirmed = window.confirm(t("courseDetail.removeAllGroupsPolicyConfirm", { title: activity.title }));
    if (!confirmed) {
      return;
    }

    setError("");
    setAssignAllSavingActivityId(activity.id);
    try {
      await api.removeActivityFromAllCourseGroupsPolicy(courseId, activity.id);
      if (assignAllActivityId === activity.id) {
        setAssignAllActivityId(null);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.removeAllGroupsPolicyError"));
    } finally {
      setAssignAllSavingActivityId(null);
    }
  }

  async function saveCourseSettings(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSavingSettings(true);
    try {
      const result = await api.updateCourseSettings(courseId, {
        studentSupportAiAgentConnectionId: studentSupportAgentId || null
      });
      setCourse(result.course);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.settingsSaveError"));
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function createCourseMaterial(event: FormEvent) {
    event.preventDefault();
    setMaterialError("");

    try {
      const parentId = materialParentId || null;
      const position = nextMaterialPosition(parentId);

      if (materialMode === "folder") {
        await api.createMaterial(courseId, {
          title: materialTitle || t("courseDetail.defaultFolderTitle"),
          kind: "folder",
          parentId,
          metadata: {},
          position
        });
      } else if (materialMode === "github_repo") {
        await api.createMaterial(courseId, {
          title: materialTitle || t("courseDetail.defaultRepoTitle"),
          kind: "github_repo",
          parentId,
          url: githubUrl,
          metadata: { source: "github" },
          position
        });
      } else {
        if (!selectedFile) {
          setMaterialError(t("courseDetail.chooseFile"));
          return;
        }
        await api.uploadMaterial(courseId, {
          title: materialTitle || selectedFile.name,
          file: selectedFile,
          parentId,
          position
        });
      }

      await refresh();
      setMaterialTitle("");
      setGithubUrl("");
      setSelectedFile(null);
      setMaterialParentId("");
      setIsAddingMaterial(false);
    } catch (err) {
      setMaterialError(err instanceof Error ? err.message : t("courseDetail.addMaterialError"));
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  function materialHref(material: CourseMaterial) {
    if (material.kind === "file") {
      return api.materialDownloadUrl(courseId, material.id);
    }
    return material.url ?? undefined;
  }

  function materialKindLabel(kind: string) {
    return kind.replace("_", " ");
  }

  function nextMaterialPosition(parentId: string | null) {
    return (course?.materials ?? []).filter((material) => (material.parentId ?? null) === parentId).length;
  }

  function materialDetail(material: CourseMaterial) {
    const originalName = typeof material.metadata?.originalName === "string" ? material.metadata.originalName : undefined;
    const size = typeof material.metadata?.size === "number" ? formatBytes(material.metadata.size) : undefined;
    if (originalName && size) {
      return `${originalName} · ${size}`;
    }
    return originalName || material.url || material.body || t("courseDetail.metadataOnly");
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
        "",
      defaultTitle: localized?.defaultTitle ?? definition?.name ?? activityTypeKey
    };
  }

  function activityTypeBelongsToCategory(activityTypeKey: string, categoryId: ActivityCategoryId) {
    const defaultCategoryIds = activityDefinitions.find((candidate) => candidate.key === activityTypeKey)?.defaultCategoryIds;
    if (defaultCategoryIds === "all") {
      return true;
    }
    if (!defaultCategoryIds?.length) {
      return categoryId === "miscellaneous";
    }
    return defaultCategoryIds.includes(categoryId);
  }

  function activityTypeIconName(activityTypeKey: string): NonNullable<ActivityDefinition["icon"]> {
    return activityDefinitions.find((candidate) => candidate.key === activityTypeKey)?.icon ?? "placeholder";
  }

  if (course && !canManage) {
    return (
      <AppShell>
        <main className="page stack">
          <p>{t("common.loading")}</p>
        </main>
      </AppShell>
    );
  }

  function startEditingMaterial(material: CourseMaterial) {
    setMaterialActionError("");
    setEditingMaterialId(material.id);
    setEditMaterialTitle(material.title);
    setEditMaterialUrl(material.url ?? "");
  }

  async function saveMaterialEdit(material: CourseMaterial) {
    setMaterialActionError("");
    try {
      await api.updateMaterial(courseId, material.id, {
        kind: material.kind as CourseMaterial["kind"],
        title: editMaterialTitle,
        url: material.kind === "github_repo" ? editMaterialUrl : undefined
      });
      setEditingMaterialId(null);
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.updateError"));
    }
  }

  async function removeMaterial(material: CourseMaterial) {
    const confirmed = window.confirm(t("courseDetail.removeConfirm", { title: material.title }));
    if (!confirmed) {
      return;
    }

    setMaterialActionError("");
    try {
      await api.deleteMaterial(courseId, material.id);
      if (editingMaterialId === material.id) {
        setEditingMaterialId(null);
      }
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.removeError"));
    }
  }

  async function moveMaterialAfterTarget(dragged: CourseMaterial, target: CourseMaterial) {
    const nextParentId = target.parentId ?? null;
    const siblings = (course?.materials ?? [])
      .filter((material) => material.id !== dragged.id && (material.parentId ?? null) === nextParentId)
      .sort(compareMaterials);
    const targetIndex = siblings.findIndex((material) => material.id === target.id);
    siblings.splice(targetIndex + 1, 0, { ...dragged, parentId: nextParentId });

    await Promise.all(
      siblings.map((material, index) =>
        api.updateMaterial(courseId, material.id, {
          parentId: nextParentId,
          position: index
        })
      )
    );
  }

  async function moveMaterialIntoFolder(dragged: CourseMaterial, folder: CourseMaterial) {
    await api.updateMaterial(courseId, dragged.id, {
      parentId: folder.id,
      position: nextMaterialPosition(folder.id)
    });
  }

  function handleMaterialPointerDown(material: CourseMaterial, event: PointerEvent) {
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
      const dropTarget = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      setDraggingMaterialId(null);
      setDragPreview(null);
      setDropTarget(null);

      if (dropTarget?.closest("[data-root-drop='true']")) {
        if (!material.parentId) {
          return;
        }
        await moveMaterialSafely(() => moveMaterialToRoot(material));
        return;
      }

      const targetElement = dropTarget?.closest("[data-material-id]");
      if (!(targetElement instanceof HTMLElement)) {
        return;
      }

      const target = (course?.materials ?? []).find((candidate) => candidate.id === targetElement.dataset.materialId);
      if (!target || target.id === material.id) {
        return;
      }

      await moveMaterialSafely(async () => {
        if (target.kind === "folder") {
          if (isMaterialDescendant(course?.materials ?? [], target.id, material.id)) {
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

  async function moveMaterialSafely(action: () => Promise<void>) {
    try {
      await action();
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.moveError"));
    }
  }

  async function moveMaterialToRoot(dragged: CourseMaterial) {
    await api.updateMaterial(courseId, dragged.id, {
      parentId: null,
      position: nextMaterialPosition(null)
    });
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

  const materials = course?.materials ?? [];
  const folders = materials.filter((material) => material.kind === "folder").sort(compareMaterials);
  const visibleMaterials = flattenMaterials(materials, collapsedFolderIds);
  const attachedBankActivityIds = new Set(
    (course?.activities ?? [])
      .map((activity) => activity.bankActivityId)
      .filter((bankActivityId): bankActivityId is string => Boolean(bankActivityId))
  );
  const selectedActivityBank = activityBanks.find((bank) => bank.id === selectedActivityBankId) ?? activityBanks[0];
  const availableBankActivities = (selectedActivityBank?.activities ?? []).filter(
    (activity) =>
      activity.lifecycle === "published" &&
      activity.currentVersionId &&
      activity.currentVersion?.lifecycle === "published" &&
      !attachedBankActivityIds.has(activity.id)
  );
  const visibleActivityTypes =
    selectedActivityPickerTab === "activity-banks"
      ? []
      : activityTypes.filter((type) => activityTypeBelongsToCategory(type.key, selectedActivityPickerTab));

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

  return (
    <AppShell>
      <main className="page stack">
        {course ? (
          <>
            <section className="hero-panel hero-panel-compact">
              <div className="hero-meta">
                <p className="eyebrow">{t(`status.${course.status}`)}</p>
                <h1>{course.title}</h1>
                {course.description ? (
                  <MarkdownRenderer markdown={course.description} className="muted" compact />
                ) : (
                  <p className="muted">{t("common.noDescription")}</p>
                )}
              </div>
              <div className="hero-actions">
                <Link className="button secondary" href={`/courses/${course.id}/edit`}>
                  {t("courseDetail.edit")}
                </Link>
              </div>
            </section>
            {error ? <p className="error">{error}</p> : null}
            <WorkspaceTabs
              ariaLabel={t("courseDetail.workspaceTabs")}
              initialTab="materials"
              tabs={[
                {
                  id: "materials",
                  label: t("courseDetail.materialsTab"),
                  render: () => (
                    <div className="stack">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{t("courseDetail.materialsEyebrow")}</p>
                      <h2>{t("courseDetail.materialsTitle")}</h2>
                    </div>
                    <button className="secondary" type="button" onClick={() => setIsAddingMaterial((current) => !current)}>
                      {isAddingMaterial ? t("common.cancel") : t("courseDetail.addMaterial")}
                    </button>
                  </div>
                  {isAddingMaterial ? (
                    <form className="form inline-panel" onSubmit={createCourseMaterial}>
                      <div className="field">
                        <label htmlFor="materialMode">{t("courseDetail.source")}</label>
                        <select
                          id="materialMode"
                          value={materialMode}
                          onChange={(event) => setMaterialMode(event.target.value as typeof materialMode)}
                        >
                          <option value="folder">{t("materialKinds.folder")}</option>
                          <option value="github_repo">{t("materialKinds.github_repo")}</option>
                          <option value="file">{t("materialKinds.file")}</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="materialParent">{t("courseDetail.location")}</label>
                        <select id="materialParent" value={materialParentId} onChange={(event) => setMaterialParentId(event.target.value)}>
                          <option value="">{t("courseDetail.topLevel")}</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="materialTitle">{t("courseDetail.activityTitle")}</label>
                        <input
                          id="materialTitle"
                          value={materialTitle}
                          onChange={(event) => setMaterialTitle(event.target.value)}
                          placeholder={
                            materialMode === "file"
                              ? t("courseDetail.fileTitlePlaceholder")
                              : materialMode === "folder"
                                ? t("courseDetail.folderTitlePlaceholder")
                                : t("courseDetail.repoTitlePlaceholder")
                          }
                        />
                      </div>
                      {materialMode === "folder" ? null : materialMode === "github_repo" ? (
                        <div className="field" key="github-repo-material">
                          <label htmlFor="githubUrl">{t("courseDetail.githubUrl")}</label>
                          <input
                            key="githubUrl"
                            id="githubUrl"
                            type="url"
                            value={githubUrl}
                            onChange={(event) => setGithubUrl(event.target.value)}
                            placeholder="https://github.com/org/repo"
                            required
                          />
                        </div>
                      ) : (
                        <div className="field" key="file-material">
                          <label htmlFor="materialFile">{t("courseDetail.file")}</label>
                          <input key="materialFile" id="materialFile" type="file" onChange={chooseFile} required />
                          <p className="muted">{t("courseDetail.maxFileSize")}</p>
                        </div>
                      )}
                      {materialError ? <p className="error">{materialError}</p> : null}
                      <div className="row">
                        <button type="submit">{t("courseDetail.addMaterialSubmit")}</button>
                        <button className="secondary" type="button" onClick={() => setIsAddingMaterial(false)}>
                          {t("common.close")}
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
                        const href = materialHref(material);
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
                                  <label htmlFor={`edit-title-${material.id}`}>{t("courseDetail.activityTitle")}</label>
                                  <input
                                    id={`edit-title-${material.id}`}
                                    value={editMaterialTitle}
                                    onChange={(event) => setEditMaterialTitle(event.target.value)}
                                    required
                                    minLength={2}
                                  />
                                </div>
                                {material.kind === "github_repo" ? (
                                  <div className="field">
                                    <label htmlFor={`edit-url-${material.id}`}>{t("courseDetail.githubEditLabel")}</label>
                                    <input
                                      id={`edit-url-${material.id}`}
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
                    <p className="muted">{t("courseDetail.noMaterials")}</p>
                  )}
                  {materialActionError ? <p className="error">{materialActionError}</p> : null}
                    </div>
                  )
                },
                {
                  id: "activities",
                  label: t("courseDetail.activitiesTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("courseDetail.activitiesEyebrow")}</p>
                          <h2>{t("courseDetail.activitiesTitle")}</h2>
                        </div>
                        <button className="secondary" type="button" onClick={() => setShowActivityPicker(true)}>
                          {t("courseDetail.activityShellTitle")}
                        </button>
                      </div>

                      {course.activities?.length ? (
                        <div className="table-list">
                          <div className="table-row table-row-activities table-head" aria-hidden="true">
                            <span>{t("courseDetail.titleHeader")}</span>
                            <span>{t("courseDetail.activityType")}</span>
                            <span>{t("courseDetail.statusHeader")}</span>
                            <span>{t("courseDetail.actionsHeader")}</span>
                          </div>
                          {course.activities.map((activity) => (
                            <div className="table-row table-row-activities" key={activity.id}>
                              <div className="table-main table-main-stack">
                                <strong>
                                  <Link href={`/courses/${course.id}/activities/${activity.id}`}>{activity.title}</Link>
                                </strong>
                                <span className="table-meta-note muted">
                                  {activityCopy(activity.activityType.key).description || t(`activityLifecycle.${activity.lifecycle}`)}
                                </span>
                                {activity.activityVersion || getAllGroupsAssignmentRule(activity)?.enabled ? (
                                  <span className="metadata-badges">
                                    {activity.activityVersion ? (
                                      <span className="metadata-badge">{`Bank version ${activity.activityVersion.versionNumber}`}</span>
                                    ) : null}
                                    {getAllGroupsAssignmentRule(activity)?.enabled ? (
                                      <span className="metadata-badge is-course-wide">
                                        {t("courseDetail.assignedToAllGroups")} ·{" "}
                                        {formatAvailabilityWindow(
                                          getAllGroupsAssignmentRule(activity)?.availableFrom,
                                          getAllGroupsAssignmentRule(activity)?.availableUntil,
                                          t
                                        )}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                              </div>
                              <span className="eyebrow">{activityCopy(activity.activityType.key).name}</span>
                              <span className="table-meta muted">{t(`activityLifecycle.${activity.lifecycle}`)}</span>
                              <div className="table-actions">
                                <button
                                  aria-label={t("courseDetail.assignAllGroups")}
                                  className="secondary icon-button"
                                  title={t("courseDetail.assignAllGroups")}
                                  type="button"
                                  onClick={() => startAssigningActivityToAllGroups(activity)}
                                >
                                  <MaterialActionIcon name="assign" />
                                </button>
                                <Link
                                  aria-label={t("courseDetail.openActivity")}
                                  className="button secondary icon-button"
                                  href={`/courses/${course.id}/activities/${activity.id}`}
                                  title={t("courseDetail.openActivity")}
                                >
                                  <MaterialActionIcon name="open" />
                                </Link>
                                <button
                                  aria-label={t("courseDetail.removeActivity")}
                                  className="danger icon-button"
                                  title={t("courseDetail.removeActivity")}
                                  type="button"
                                  onClick={() => removeActivity(activity)}
                                >
                                  <MaterialActionIcon name="remove" />
                                </button>
                              </div>
                              {assignAllActivityId === activity.id ? (
                                <form className="form inline-panel table-inline-form" onSubmit={assignActivityToAllGroups}>
                                  <div>
                                    <p className="eyebrow">{t("courseDetail.assignAllGroupsEyebrow")}</p>
                                    <h2>{t("courseDetail.assignAllGroupsTitle")}</h2>
                                    <p className="muted">{t("courseDetail.assignAllGroupsText")}</p>
                                  </div>
                                  <div className="grid compact-form-grid">
                                    <div className="field">
                                      <label htmlFor={`assign-all-from-${activity.id}`}>{t("groupPage.availableFrom")}</label>
                                      <DateTimeMinuteInput
                                        id={`assign-all-from-${activity.id}`}
                                        value={assignAllAvailableFrom}
                                        onChange={setAssignAllAvailableFrom}
                                        disabled={assignAllSavingActivityId === activity.id}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`assign-all-until-${activity.id}`}>{t("groupPage.availableUntil")}</label>
                                      <DateTimeMinuteInput
                                        id={`assign-all-until-${activity.id}`}
                                        value={assignAllAvailableUntil}
                                        onChange={setAssignAllAvailableUntil}
                                        disabled={assignAllSavingActivityId === activity.id}
                                      />
                                    </div>
                                  </div>
                                  <label className="checkbox-row" htmlFor={`assign-all-overrides-${activity.id}`}>
                                    <input
                                      id={`assign-all-overrides-${activity.id}`}
                                      type="checkbox"
                                      checked={assignAllEnablePerGroupSettings}
                                      disabled={assignAllSavingActivityId === activity.id}
                                      onChange={(event) => setAssignAllEnablePerGroupSettings(event.target.checked)}
                                    />
                                    <span>{t("courseDetail.enablePerGroupSettings")}</span>
                                  </label>
                                  <div className="field">
                                    <label htmlFor={`assign-all-mode-${activity.id}`}>{t("groupPage.assessmentMode")}</label>
                                    <select
                                      id={`assign-all-mode-${activity.id}`}
                                      value={assignAllAssessmentMode}
                                      disabled={assignAllSavingActivityId === activity.id}
                                      onChange={(event) => setAssignAllAssessmentMode(event.target.value as "formative" | "summative")}
                                    >
                                      <option value="formative">{t("groupPage.assessmentModeFormative")}</option>
                                      <option value="summative">{t("groupPage.assessmentModeSummative")}</option>
                                    </select>
                                  </div>
                                  {assignAllAssessmentMode === "summative" ? (
                                    <div className="grid compact-form-grid">
                                      <div className="field">
                                        <label htmlFor={`assign-all-points-${activity.id}`}>{t("groupPage.pointsPossible")}</label>
                                        <input
                                          id={`assign-all-points-${activity.id}`}
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={assignAllPointsPossible}
                                          disabled={assignAllSavingActivityId === activity.id}
                                          onChange={(event) => setAssignAllPointsPossible(event.target.value)}
                                        />
                                      </div>
                                      <div className="field">
                                        <label htmlFor={`assign-all-grading-mode-${activity.id}`}>{t("groupPage.gradingMode")}</label>
                                        <select
                                          id={`assign-all-grading-mode-${activity.id}`}
                                          value={assignAllGradingMode}
                                          disabled={assignAllSavingActivityId === activity.id}
                                          onChange={(event) => setAssignAllGradingMode(event.target.value as "points" | "pass_fail")}
                                        >
                                          <option value="points">{t("groupPage.gradingModePoints")}</option>
                                          <option value="pass_fail">{t("groupPage.gradingModePassFail")}</option>
                                        </select>
                                      </div>
                                      {assignAllGradingMode === "pass_fail" ? (
                                        <>
                                          <div className="field">
                                            <label htmlFor={`assign-all-pass-points-${activity.id}`}>{t("groupPage.passThresholdPoints")}</label>
                                            <input
                                              id={`assign-all-pass-points-${activity.id}`}
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={assignAllPassThresholdPoints}
                                              disabled={assignAllSavingActivityId === activity.id}
                                              onChange={(event) => setAssignAllPassThresholdPoints(event.target.value)}
                                            />
                                          </div>
                                          <div className="field">
                                            <label htmlFor={`assign-all-pass-out-of-${activity.id}`}>{t("groupPage.passThresholdOutOf")}</label>
                                            <input
                                              id={`assign-all-pass-out-of-${activity.id}`}
                                              type="number"
                                              min="0.01"
                                              step="0.01"
                                              value={assignAllPassThresholdOutOf}
                                              disabled={assignAllSavingActivityId === activity.id}
                                              onChange={(event) => setAssignAllPassThresholdOutOf(event.target.value)}
                                            />
                                          </div>
                                        </>
                                      ) : null}
                                      <div className="field">
                                        <label htmlFor={`assign-all-attempt-mode-${activity.id}`}>{t("groupPage.attemptLimitMode")}</label>
                                        <select
                                          id={`assign-all-attempt-mode-${activity.id}`}
                                          value={assignAllAttemptLimitMode}
                                          disabled={assignAllSavingActivityId === activity.id}
                                          onChange={(event) =>
                                            setAssignAllAttemptLimitMode(event.target.value as "unlimited" | "max_attempts" | "until_due")
                                          }
                                        >
                                          <option value="unlimited">{t("groupPage.attemptLimitUnlimited")}</option>
                                          <option value="max_attempts">{t("groupPage.attemptLimitMax")}</option>
                                          <option value="until_due">{t("groupPage.attemptLimitUntilDue")}</option>
                                        </select>
                                      </div>
                                      {assignAllAttemptLimitMode === "max_attempts" ? (
                                        <div className="field">
                                          <label htmlFor={`assign-all-max-attempts-${activity.id}`}>{t("groupPage.maxAttempts")}</label>
                                          <input
                                            id={`assign-all-max-attempts-${activity.id}`}
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={assignAllMaxAttempts}
                                            disabled={assignAllSavingActivityId === activity.id}
                                            onChange={(event) => setAssignAllMaxAttempts(event.target.value)}
                                          />
                                        </div>
                                      ) : null}
                                      <div className="field">
                                        <label htmlFor={`assign-all-grade-strategy-${activity.id}`}>{t("groupPage.gradeStrategy")}</label>
                                        <select
                                          id={`assign-all-grade-strategy-${activity.id}`}
                                          value={assignAllGradeStrategy}
                                          disabled={assignAllSavingActivityId === activity.id}
                                          onChange={(event) =>
                                            setAssignAllGradeStrategy(event.target.value as "latest" | "best" | "first" | "weighted_average")
                                          }
                                        >
                                          <option value="latest">{t("groupPage.gradeStrategyLatest")}</option>
                                          <option value="best">{t("groupPage.gradeStrategyBest")}</option>
                                          <option value="first">{t("groupPage.gradeStrategyFirst")}</option>
                                          <option value="weighted_average">{t("groupPage.gradeStrategyWeightedAverage")}</option>
                                        </select>
                                      </div>
                                      {assignAllGradeStrategy === "weighted_average" ? (
                                        <label className="checkbox-row" htmlFor={`assign-all-drop-lowest-${activity.id}`}>
                                          <input
                                            id={`assign-all-drop-lowest-${activity.id}`}
                                            type="checkbox"
                                            checked={assignAllDropLowestAttempt}
                                            disabled={assignAllSavingActivityId === activity.id}
                                            onChange={(event) => setAssignAllDropLowestAttempt(event.target.checked)}
                                          />
                                          <span>{t("groupPage.dropLowestAttempt")}</span>
                                        </label>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <div className="row">
                                    <button disabled={assignAllSavingActivityId === activity.id} type="submit">
                                      {assignAllSavingActivityId === activity.id ? t("common.saving") : t("courseDetail.assignAllGroupsSave")}
                                    </button>
                                    {getAllGroupsAssignmentRule(activity)?.enabled ? (
                                      <button
                                        className="danger"
                                        disabled={assignAllSavingActivityId === activity.id}
                                        type="button"
                                        onClick={() => removeActivityFromAllGroupsPolicy(activity)}
                                      >
                                        {t("courseDetail.removeAllGroupsPolicy")}
                                      </button>
                                    ) : null}
                                    <button className="secondary" type="button" onClick={() => setAssignAllActivityId(null)}>
                                      {t("common.cancel")}
                                    </button>
                                  </div>
                                </form>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">{t("courseDetail.noActivities")}</p>
                      )}
                    </section>
                  )
                },
                {
                  id: "groups",
                  label: t("courseDetail.groupsTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("courseDetail.groupsEyebrow")}</p>
                          <h2>{t("courseDetail.groupsTitle")}</h2>
                        </div>
                        <button className="secondary" type="button" onClick={() => setIsAddingGroup((current) => !current)}>
                          {isAddingGroup ? t("common.cancel") : t("courseDetail.groupShellTitle")}
                        </button>
                      </div>

                      {isAddingGroup ? (
                        <form className="form inline-panel" onSubmit={createGroup}>
                          <div>
                            <p className="eyebrow">{t("courseDetail.groupShellEyebrow")}</p>
                            <h2>{t("courseDetail.groupShellTitle")}</h2>
                          </div>
                          <div className="field">
                            <label htmlFor="groupTitle">{t("courseDetail.groupTitle")}</label>
                            <input
                              id="groupTitle"
                              value={groupTitle}
                              onChange={(event) => setGroupTitle(event.target.value)}
                              placeholder={t("courseDetail.groupTitlePlaceholder")}
                              required
                              minLength={2}
                            />
                          </div>
                          <div className="row">
                            <button type="submit">{t("courseDetail.createGroup")}</button>
                            <button className="secondary" type="button" onClick={() => setIsAddingGroup(false)}>
                              {t("common.close")}
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {course.groups?.length ? (
                        <div className="table-list">
                          <div className="table-row table-row-groups table-head" aria-hidden="true">
                            <span>{t("courseDetail.titleHeader")}</span>
                            <span>{t("courseDetail.availabilityHeader")}</span>
                            <span>{t("courseDetail.statusHeader")}</span>
                            <span>{t("courseDetail.actionsHeader")}</span>
                          </div>
                          {course.groups.map((group) => (
                            <div className="table-row table-row-groups" key={group.id}>
                              <div className="table-main">
                                <strong>
                                  <Link href={`/courses/${course.id}/groups/${group.id}`}>{group.title}</Link>
                                </strong>
                              </div>
                              <span className="table-meta muted">{formatAvailabilityWindow(group.availableFrom, group.availableUntil, t)}</span>
                              <span className="table-meta muted">{group.status === "published" ? t("groupPage.statusPublished") : t("groupPage.statusDraft")}</span>
                              <div className="table-actions">
                                <Link
                                  aria-label={t("courseDetail.openGroup")}
                                  className="button secondary icon-button"
                                  href={`/courses/${course.id}/groups/${group.id}`}
                                  title={t("courseDetail.openGroup")}
                                >
                                  <MaterialActionIcon name="open" />
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">{t("courseDetail.noGroups")}</p>
                      )}
                    </section>
                  )
                },
                {
                  id: "gradebook",
                  label: t("courseDetail.gradebookTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("courseDetail.gradebookEyebrow")}</p>
                          <h2>{t("courseDetail.gradebookTitle")}</h2>
                        </div>
                        <a
                          className="button secondary"
                          href={api.courseGradebookCsvUrl(courseId, {
                            groupId: gradebookGroupId || undefined,
                            activityId: gradebookActivityId || undefined,
                            status: gradebookStatus
                          })}
                        >
                          {t("courseDetail.exportCsv")}
                        </a>
                      </div>

                      <div className="form inline-panel gradebook-filters">
                        <div className="field">
                          <label htmlFor="gradebook-group-filter">{t("courseDetail.groupFilter")}</label>
                          <select id="gradebook-group-filter" value={gradebookGroupId} onChange={(event) => setGradebookGroupId(event.target.value)}>
                            <option value="">{t("courseDetail.allGroups")}</option>
                            {(gradebook?.groups ?? []).map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="gradebook-activity-filter">{t("courseDetail.activityFilter")}</label>
                          <select
                            id="gradebook-activity-filter"
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
                          <label htmlFor="gradebook-status-filter">{t("courseDetail.statusFilter")}</label>
                          <select
                            id="gradebook-status-filter"
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

                      {gradebook?.rows.length ? (
                        <div className="table-list">
                          <div className="table-row table-row-gradebook table-head" aria-hidden="true">
                            <span>{t("courseDetail.studentHeader")}</span>
                            <span>{t("courseDetail.groupHeader")}</span>
                            <span>{t("courseDetail.activityHeader")}</span>
                            <span>{t("courseDetail.gradeHeader")}</span>
                            <span>{t("courseDetail.statusHeader")}</span>
                          </div>
                          {gradebook.rows.map((row) => (
                            <div className="table-row table-row-gradebook" key={`${row.gradebookItemId}-${row.participantId}`}>
                              <div className="table-main table-main-stack">
                                <strong>{row.participantName}</strong>
                                <span className="table-meta-note muted">{row.participantEmail}</span>
                                {row.externalId ? <span className="metadata-badge">{row.externalId}</span> : null}
                              </div>
                              <span className="table-meta muted">{row.groupTitle}</span>
                              <div className="table-main table-main-stack">
                                <strong>{row.activityTitle}</strong>
                                <span className="table-meta-note muted">{row.activityTypeName}</span>
                              </div>
                              <div className="table-main table-main-stack">
                                <strong>{formatGradebookScore(row.score, row.maxScore)}</strong>
                                <span className="table-meta-note muted">
                                  {t("courseDetail.attemptSummary", {
                                    count: row.attemptCount,
                                    selected: row.selectedAttemptNumber ?? "-"
                                  })}
                                </span>
                                {row.attempts.length ? (
                                  <span className="table-meta-note muted">
                                    {row.attempts
                                      .map((attempt) =>
                                        t("courseDetail.attemptHistoryItem", {
                                          number: attempt.attemptNumber,
                                          status: t(`courseDetail.attemptLifecycle.${attempt.lifecycle}`)
                                        })
                                      )
                                      .join(" · ")}
                                  </span>
                                ) : null}
                              </div>
                              <span className={`participant-status is-${row.status.replace("_", "-")}`}>
                                {t(`courseDetail.gradebookStatus.${row.status}`)}
                                {row.latePenaltyApplied && row.latePenaltyPercent !== null ? ` -${row.latePenaltyPercent}%` : ""}
                              </span>
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
                  id: "settings",
                  label: t("courseDetail.settingsTab"),
                  render: () => (
                    <section className="section stack">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">{t("courseDetail.settingsEyebrow")}</p>
                          <h2>{t("courseDetail.settingsTitle")}</h2>
                        </div>
                      </div>

                      <form className="form" onSubmit={saveCourseSettings}>
                        <div className="field">
                          <label htmlFor="studentSupportAgent">{t("courseDetail.studentSupportAgent")}</label>
                          <select
                            id="studentSupportAgent"
                            value={studentSupportAgentId}
                            onChange={(event) => setStudentSupportAgentId(event.target.value)}
                          >
                            <option value="">{t("courseDetail.noAiAgentSelected")}</option>
                            {aiAgentConnections.map((connection) => (
                              <option key={connection.id} value={connection.id}>
                                {formatAiAgentOption(connection, t)}
                              </option>
                            ))}
                          </select>
                          <p className="muted">{t("courseDetail.studentSupportAgentHelp")}</p>
                        </div>

                        {aiAgentConnections.length ? null : <p className="muted">{t("courseDetail.noAiAgentsAvailable")}</p>}

                        <div className="row">
                          <button disabled={isSavingSettings} type="submit">
                            {isSavingSettings ? t("common.saving") : t("courseDetail.saveSettings")}
                          </button>
                        </div>
                      </form>
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
            {showActivityPicker ? (
              <div className="dialog-backdrop" role="presentation">
                <section
                  aria-labelledby="course-activity-picker-title"
                  aria-modal="true"
                  className="dialog-panel activity-picker-dialog"
                  role="dialog"
                >
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{t("courseDetail.chooseActivityEyebrow")}</p>
                      <h2 id="course-activity-picker-title">{t("courseDetail.chooseActivityTitle")}</h2>
                    </div>
                    <button className="secondary icon-button" onClick={() => setShowActivityPicker(false)} title={t("common.cancel")} type="button">
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="activity-picker-layout">
                    <div className="activity-category-tabs" role="tablist" aria-label={t("activityBankDetail.categoryTabsLabel")}>
                      <button
                        aria-selected={selectedActivityPickerTab === "activity-banks"}
                        className={selectedActivityPickerTab === "activity-banks" ? "activity-category-tab is-active" : "activity-category-tab"}
                        onClick={() => setSelectedActivityPickerTab("activity-banks")}
                        role="tab"
                        type="button"
                      >
                        {t("courseDetail.activityBanksPickerTab")}
                      </button>
                      {activityCategories.map((category) => (
                        <button
                          key={category.id}
                          aria-selected={selectedActivityPickerTab === category.id}
                          className={selectedActivityPickerTab === category.id ? "activity-category-tab is-active" : "activity-category-tab"}
                          onClick={() => setSelectedActivityPickerTab(category.id)}
                          role="tab"
                          type="button"
                        >
                          {t(category.labelKey)}
                        </button>
                      ))}
                    </div>
                    <div className="activity-type-options" role="tabpanel">
                      {selectedActivityPickerTab === "activity-banks" ? (
                        <div className="activity-bank-picker-panel">
                          <div className="field">
                            <label htmlFor="courseActivityBank">{t("courseDetail.activityBankPickerLabel")}</label>
                            <select
                              id="courseActivityBank"
                              value={selectedActivityBank?.id ?? ""}
                              onChange={(event) => setSelectedActivityBankId(event.target.value)}
                              disabled={!activityBanks.length || isAddingActivity}
                            >
                              {activityBanks.map((bank) => (
                                <option key={bank.id} value={bank.id}>
                                  {bank.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          {availableBankActivities.length ? (
                            availableBankActivities.map((activity) => (
                              <button
                                key={activity.id}
                                className="activity-type-option"
                                disabled={isAddingActivity}
                                onClick={() => attachBankActivity(activity)}
                                type="button"
                              >
                                <ActivityTypeIcon iconName={activityTypeIconName(activity.activityType.key)} />
                                <span>
                                  <strong>{activity.title}</strong>
                                  <small>
                                    v{activity.currentVersion?.versionNumber ?? 1} · {activityCopy(activity.activityType.key).name}
                                  </small>
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="muted">{t("courseDetail.noAvailableBankActivities")}</p>
                          )}
                        </div>
                      ) : (
                        visibleActivityTypes.map((type) => (
                          <button
                            key={type.id}
                            className="activity-type-option"
                            disabled={isAddingActivity}
                            onClick={() => createLocalActivity(type.key)}
                            type="button"
                          >
                            <ActivityTypeIcon iconName={activityTypeIconName(type.key)} />
                            <span>
                              <strong>{activityCopy(type.key).name}</strong>
                              <small>{activityCopy(type.key).description}</small>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        ) : (
          <p>Loading course...</p>
        )}
      </main>
    </AppShell>
  );
}

function getCourseAiSettings(course: Course) {
  const metadata = course.metadata ?? {};
  const aiSettings = metadata.aiSettings;
  if (!aiSettings || typeof aiSettings !== "object" || Array.isArray(aiSettings)) {
    return {
      studentSupportAiAgentConnectionId: ""
    };
  }
  const record = aiSettings as Record<string, unknown>;
  return {
    studentSupportAiAgentConnectionId: typeof record.studentSupportAiAgentConnectionId === "string" ? record.studentSupportAiAgentConnectionId : ""
  };
}

function formatAiAgentOption(connection: AiAgentConnection, t: (key: string, vars?: Record<string, string | number>) => string) {
  const scope = connection.scope === "global" ? t("courseDetail.aiAgentScopeGlobal") : t("courseDetail.aiAgentScopePersonal");
  return `${connection.displayName} · ${t(`aiAgentProviders.${connection.provider}`)} · ${connection.model} · ${scope}`;
}

function getAllGroupsAssignmentRule(activity: NonNullable<Course["activities"]>[number]) {
  const rule = activity.metadata?.allGroupsAssignment;
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  const record = rule as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    availableFrom: typeof record.availableFrom === "string" ? record.availableFrom : null,
    availableUntil: typeof record.availableUntil === "string" ? record.availableUntil : null,
    enablePerGroupSettings: record.enablePerGroupSettings !== false,
    assessmentMode: record.assessmentMode === "summative" ? "summative" as const : "formative" as const,
    gradebookSettings:
      record.gradebookSettings && typeof record.gradebookSettings === "object" && !Array.isArray(record.gradebookSettings)
        ? (record.gradebookSettings as {
            pointsPossible?: number;
            gradingMode?: "points" | "pass_fail";
            passThresholdPoints?: number | null;
            passThresholdOutOf?: number | null;
            attemptLimitMode?: "unlimited" | "max_attempts" | "until_due";
            maxAttempts?: number | null;
            gradeStrategy?: "latest" | "best" | "first" | "weighted_average";
            dropLowestAttempt?: boolean;
          })
        : null
  };
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function formatGradebookScore(score: number | null, maxScore: number) {
  if (score === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

function formatGradeNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function compareMaterials(left: CourseMaterial, right: CourseMaterial) {
  return left.position - right.position || left.title.localeCompare(right.title);
}

function flattenMaterials(materials: CourseMaterial[], collapsedFolderIds: Set<string>) {
  const materialIds = new Set(materials.map((material) => material.id));
  const byParent = new Map<string, CourseMaterial[]>();
  for (const material of materials) {
    const parentId = material.parentId ?? "root";
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), material]);
  }

  for (const [parentId, children] of byParent) {
    byParent.set(parentId, children.sort(compareMaterials));
  }

  const rows: { material: CourseMaterial; depth: number }[] = [];
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

function isMaterialDescendant(materials: CourseMaterial[], possibleChildId: string, possibleAncestorId: string) {
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

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function ActivityTypeIcon({ iconName }: { iconName: NonNullable<ActivityDefinition["icon"]> }) {
  if (iconName === "checklist") {
    return (
      <span className="activity-type-icon" aria-hidden="true">
        <svg fill="none" height="28" viewBox="0 0 32 32" width="28">
          <path d="M8 9h5M8 16h5M8 23h5M17 9h7M17 16h7M17 23h7" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M5 6h22v20H5z" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
    );
  }

  if (iconName === "list-check") {
    return (
      <span className="activity-type-icon" aria-hidden="true">
        <svg fill="none" height="28" viewBox="0 0 32 32" width="28">
          <path d="M7 8h18M7 14h13M7 20h18M7 26h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M5 5h22v22H5z" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
    );
  }

  if (iconName === "code") {
    return (
      <span className="activity-type-icon" aria-hidden="true">
        <svg fill="none" height="28" viewBox="0 0 32 32" width="28">
          <path d="m13 10-6 6 6 6M19 10l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M5 5h22v22H5z" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
    );
  }

  if (iconName === "document-check") {
    return (
      <span className="activity-type-icon" aria-hidden="true">
        <svg fill="none" height="28" viewBox="0 0 32 32" width="28">
          <path d="M10 17l4 4 8-10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M7 5h18v22H7z" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
    );
  }

  return (
    <span className="activity-type-icon" aria-hidden="true">
      <svg fill="none" height="28" viewBox="0 0 32 32" width="28">
        <path d="M8 8h16v16H8z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 16h8M16 12v8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    </span>
  );
}

function MaterialActionIcon({ name }: { name: "assign" | "download" | "drag" | "edit" | "open" | "remove" }) {
  const paths = {
    assign: (
      <>
        <path d="M4 6h10" />
        <path d="M4 12h8" />
        <path d="M4 18h6" />
        <path d="M15 16l2 2 4-5" />
      </>
    ),
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
        <path d="m4 16 1 4 4-1 9-9-5-5-9 9Z" />
        <path d="m12 6 5 5" />
      </>
    ),
    open: (
      <>
        <path d="M8 8h8v8" />
        <path d="m8 16 8-8" />
        <path d="M5 5h6" />
        <path d="M5 5v14h14v-6" />
      </>
    ),
    remove: (
      <>
        <path d="M6 7h12" />
        <path d="M9 7V5h6v2" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M8 7l1 13h6l1-13" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      {paths[name]}
    </svg>
  );
}
