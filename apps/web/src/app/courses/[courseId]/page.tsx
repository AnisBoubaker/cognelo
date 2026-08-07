"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import {
  activityDefinitionBelongsToCategory,
  activityDefinitionCreatesCategory,
  listActivityCategories,
  type ActivityCategoryId
} from "@cognelo/activity-sdk/categories";
import { resolveLocalizedText, type ContentTypeDefinition } from "@cognelo/content-type-sdk";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import {
  api,
  ActivityBank,
  ActivityDefinition,
  ActivityType,
  AiAgentConnection,
  Course,
  CourseContentItem,
  CourseContentResource,
  CourseGradebook,
  CourseGradebookItemSummary,
  CourseGradebookRow,
  CourseMaterial,
  GradebookStatus
} from "@/lib/api";
import { ContentTypeIcon as MaterialTypeIcon, resolveContentTypeSettingsRenderer } from "@/lib/content-type-renderers";
import { useI18n } from "@/lib/i18n";

type ActivityPickerTabId = "activity-banks" | ActivityCategoryId | "material";
type ActivityPickerTab = {
  id: ActivityPickerTabId;
  label: string;
};
type ContentDropPlacement = "after" | "before" | "inside";
type ContentDropTarget = { id: string; type: "root" } | { id: string; placement: ContentDropPlacement; type: "content" };
type ContentContextMenu = {
  itemId: string;
  x: number;
  y: number;
};

const contentDragActivationDistance = 8;

const activityCategories = listActivityCategories();

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { locale, t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [contentTypeDefinitions, setContentTypeDefinitions] = useState<ContentTypeDefinition[]>([]);
  const [activeContentTypeDefinitions, setActiveContentTypeDefinitions] = useState<ContentTypeDefinition[]>([]);
  const [contentResources, setContentResources] = useState<CourseContentResource[]>([]);
  const [activityBanks, setActivityBanks] = useState<ActivityBank[]>([]);
  const [aiAgentConnections, setAiAgentConnections] = useState<AiAgentConnection[]>([]);
  const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
  const [contentItems, setContentItems] = useState<CourseContentItem[]>([]);
  const [gradebookGroupId, setGradebookGroupId] = useState("");
  const [gradebookActivityId, setGradebookActivityId] = useState("");
  const [gradebookStatus, setGradebookStatus] = useState<GradebookStatus>("all");
  const [savingReleaseItemId, setSavingReleaseItemId] = useState<string | null>(null);
  const [expandedGradebookActivityIds, setExpandedGradebookActivityIds] = useState<Set<string>>(new Set());
  const [studentSupportAgentId, setStudentSupportAgentId] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [selectedActivityPickerTab, setSelectedActivityPickerTab] = useState<ActivityPickerTabId>("activity-banks");
  const [selectedActivityBankId, setSelectedActivityBankId] = useState("");
  const [pickerParentId, setPickerParentId] = useState("");
  const [pickerIsVisible, setPickerIsVisible] = useState(true);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderTitle, setEditingFolderTitle] = useState("");
  const [editingFolderSelectAll, setEditingFolderSelectAll] = useState(false);
  const [assignAllActivityId, setAssignAllActivityId] = useState<string | null>(null);
  const [assignAllParentId, setAssignAllParentId] = useState("");
  const [assignAllIsVisible, setAssignAllIsVisible] = useState(true);
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
  const [settingsContentItemId, setSettingsContentItemId] = useState<string | null>(null);
  const [settingsMaterialTitle, setSettingsMaterialTitle] = useState("");
  const [settingsMaterialUrl, setSettingsMaterialUrl] = useState("");
  const [settingsMaterialBody, setSettingsMaterialBody] = useState("");
  const [settingsMaterialFile, setSettingsMaterialFile] = useState<File | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [draggingContentItemId, setDraggingContentItemId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ title: string; x: number; y: number } | null>(null);
  const [contentDropTarget, setContentDropTarget] = useState<ContentDropTarget | null>(null);
  const [collapsedContentFolderIds, setCollapsedContentFolderIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [materialActionError, setMaterialActionError] = useState("");
  const [contentContextMenu, setContentContextMenu] = useState<ContentContextMenu | null>(null);
  const [pickerFolderMenuOpen, setPickerFolderMenuOpen] = useState(false);
  const [contentHeaderMenuOpen, setContentHeaderMenuOpen] = useState(false);
  const folderTitleInputRef = useRef<HTMLInputElement | null>(null);
  const cancelFolderEditRef = useRef(false);
  const skipFolderBlurRef = useRef(false);

  async function refresh() {
    const [courseResult, typeResult] = await Promise.all([api.course(courseId), api.activityTypes()]);
    setCourse(courseResult.course);
    setActivityTypes(typeResult.activityTypes);
    setActivityDefinitions(typeResult.registeredDefinitions);
    const role = courseResult.course.memberships?.find((membership) => membership.userId === user?.id)?.role;
    const userCanManage = user?.roles.includes("admin") || role === "owner" || role === "teacher";
    if (userCanManage) {
      const [gradebookResult, contentResult, contentTypesResult, contentResourcesResult] = await Promise.all([
        api.courseGradebook(courseId, {
          groupId: gradebookGroupId || undefined,
          activityId: gradebookActivityId || undefined,
          status: gradebookStatus
        }),
        api.courseContent(courseId),
        api.courseContentTypes(courseId),
        api.courseContentResources(courseId)
      ]);
      setGradebook(gradebookResult.gradebook);
      setContentItems(contentResult.contentItems);
      setContentTypeDefinitions(contentTypesResult.contentTypes);
      setActiveContentTypeDefinitions(contentTypesResult.activeContentTypes ?? contentTypesResult.contentTypes);
      setContentResources(contentResourcesResult.resources);
    } else {
      setGradebook(null);
      setContentItems([]);
      setContentTypeDefinitions([]);
      setActiveContentTypeDefinitions([]);
      setContentResources([]);
    }
    const aiSettings = getCourseAiSettings(courseResult.course);
    setStudentSupportAgentId(aiSettings.studentSupportAiAgentConnectionId);
    api
      .aiAgentConnections()
      .then((aiAgentResult) => setAiAgentConnections(aiAgentResult.connections.filter((connection) => connection.isEnabled)))
      .catch(() => setAiAgentConnections([]));
    if (userCanManage && courseResult.course.subjectId) {
      const banksResult = await api.activityBanks(courseResult.course.subjectId);
      setActivityBanks(banksResult.activityBanks);
    } else {
      setActivityBanks([]);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [courseId, t, user, gradebookGroupId, gradebookActivityId, gradebookStatus]);

  useEffect(() => {
    if (!editingFolderId) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const input = folderTitleInputRef.current;
      if (!input || input.dataset.folderId !== editingFolderId) {
        return;
      }
      input.focus();
      if (editingFolderSelectAll) {
        input.select();
      } else {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingFolderId, editingFolderSelectAll, contentItems]);

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

  async function setGradebookItemsRelease(gradebookItemIds: string[], released: boolean, activityTitle: string) {
    const uniqueItemIds = [...new Set(gradebookItemIds)];
    if (!uniqueItemIds.length) {
      return;
    }

    const confirmed = window.confirm(
      t(released ? "courseDetail.releaseGradesConfirm" : "courseDetail.hideGradesConfirm", { title: activityTitle })
    );
    if (!confirmed) {
      return;
    }

    setSavingReleaseItemId(uniqueItemIds.join(":"));
    setError("");
    try {
      await Promise.all(uniqueItemIds.map((itemId) => api.setGradebookItemRelease(courseId, itemId, { released })));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.gradeReleaseError"));
    } finally {
      setSavingReleaseItemId(null);
    }
  }

  function toggleGradebookActivity(activityId: string) {
    setExpandedGradebookActivityIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  }

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";
  const studentRedirectGroupId = course && !canManage ? course.groups?.[0]?.id : null;
  const gradebookActivities = buildGradebookActivitySummaries(gradebook?.items ?? [], gradebook?.rows ?? []);
  const gradebookOverview = buildGradebookOverview(gradebookActivities);

  useEffect(() => {
    if (studentRedirectGroupId) {
      router.replace(`/courses/${courseId}/groups/${studentRedirectGroupId}`);
    }
  }, [courseId, router, studentRedirectGroupId]);

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
    if (!contentContextMenu) {
      return;
    }

    function closeMenu() {
      setContentContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContentContextMenu(null);
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contentContextMenu]);

  useEffect(() => {
    if (!pickerFolderMenuOpen) {
      return;
    }

    function closeMenu() {
      setPickerFolderMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerFolderMenuOpen(false);
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerFolderMenuOpen]);

  useEffect(() => {
    if (!contentHeaderMenuOpen) {
      return;
    }

    function closeMenu() {
      setContentHeaderMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContentHeaderMenuOpen(false);
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contentHeaderMenuOpen]);


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
        position: course?.activities?.length ?? 0,
        contentPlacement: buildPickerContentPlacement(selectedActivityCopy.defaultTitle || t("courseDetail.defaultActivityTitle"))
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

  async function createLocalTest() {
    setError("");
    setIsAddingActivity(true);
    try {
      const definition = activityDefinitions.find((candidate) => candidate.key === "test");
      const localized = definition?.i18n?.[locale];
      const title = localized?.defaultTitle ?? "New test";
      const result = await api.createTest(courseId, {
        title,
        description: localized?.description ?? definition?.description ?? "",
        lifecycle: "draft",
        position: course?.activities?.length ?? 0,
        contentPlacement: buildPickerContentPlacement(title)
      });
      setShowActivityPicker(false);
      await refresh();
      router.push(`/courses/${courseId}/activities/${result.test.activityId}`);
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
        position: course?.activities?.length ?? 0,
        contentPlacement: buildPickerContentPlacement(bankActivity.title)
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

  async function createInlineFolder(parentId: string | null) {
    setMaterialActionError("");
    setIsAddingActivity(true);
    try {
      const title = t("courseDetail.defaultFolderTitle");
      const result = await api.createContentFolder(courseId, {
        title,
        parentId,
        isVisible: true,
        position: 0
      });
      const siblings = contentItems.filter((item) => item.id !== result.contentItem.id && (item.parentId ?? null) === parentId && !item.groupId).sort(compareContentItems);
      await Promise.all([
        api.updateContentItem(courseId, result.contentItem.id, { position: 0 }),
        ...siblings.map((item, index) => api.updateContentItem(courseId, item.id, { position: index + 1 }))
      ]);
      if (parentId) {
        setCollapsedContentFolderIds((current) => {
          const next = new Set(current);
          next.delete(parentId);
          return next;
        });
      }
      startEditingFolder({ ...result.contentItem, titleSnapshot: title }, true);
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.createMaterialError"));
    } finally {
      setIsAddingActivity(false);
    }
  }

  async function createPickerContentResource(definition: ContentTypeDefinition) {
    setError("");
    setIsAddingActivity(true);
    try {
      const title = resolveLocalizedText(definition.defaultTitle, locale);
      const result = await api.createCourseContentResource(courseId, {
        contentTypeKey: definition.key,
        payload: { title },
        parentId: pickerParentId || null,
        isVisible: pickerIsVisible
      });
      setSettingsContentItemId(result.contentItem.id);
      setSettingsMaterialTitle(title);
      setSettingsMaterialUrl("");
      setSettingsMaterialBody("");
      setSettingsMaterialFile(null);
      setShowActivityPicker(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.createMaterialError"));
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
    setAssignAllParentId(rule?.contentPlacement?.parentId ?? "");
    setAssignAllIsVisible(rule?.contentPlacement?.isVisible ?? true);
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
        ...(assignAllAssessmentMode === "summative" ? { gradebookSettings: buildAssignAllGradebookSettings() } : {}),
        contentPlacement: {
          parentId: assignAllParentId || null,
          isVisible: assignAllIsVisible,
          metadata: {}
        }
      });
      setAssignAllActivityId(null);
      setAssignAllParentId("");
      setAssignAllIsVisible(true);
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
      closeContentSettings();
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

  function materialHref(material: CourseMaterial) {
    if (legacyMaterialHasStoredFile(material)) {
      return withMaterialDownloadVersion(api.materialDownloadUrl(courseId, material.id), material);
    }
    return material.url ?? undefined;
  }

  function contentResourceDetail(resource: CourseContentResource) {
    const originalName = typeof resource.metadata?.originalName === "string" ? resource.metadata.originalName : undefined;
    const size = typeof resource.metadata?.size === "number" ? formatBytes(resource.metadata.size) : undefined;
    if (originalName && size) {
      return `${originalName} · ${size}`;
    }
    return originalName || (typeof resource.metadata?.url === "string" ? resource.metadata.url : undefined) || t("courseDetail.metadataOnly");
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
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    return activityDefinitionBelongsToCategory(definition, categoryId);
  }

  function activityTypeCreatesCategory(activityTypeKey: string, categoryId: ActivityCategoryId) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    return activityDefinitionCreatesCategory(definition, categoryId);
  }

  function activityTypeIconName(activityTypeKey: string): NonNullable<ActivityDefinition["icon"]> {
    return activityDefinitions.find((candidate) => candidate.key === activityTypeKey)?.icon ?? "placeholder";
  }

  const visibleActivityCategories = activityCategories.filter((category) =>
    activityTypes.some((type) => activityTypeCreatesCategory(type.key, category.id))
  );
  const activityPickerTabs: ActivityPickerTab[] = [
    { id: "activity-banks", label: t("courseDetail.activityBanksPickerTab") },
    { id: "material", label: t("courseDetail.materialPickerTab") },
    ...visibleActivityCategories.map((category) => ({ id: category.id, label: t(category.labelKey) }))
  ];

  useEffect(() => {
    if (selectedActivityPickerTab === "activity-banks" || selectedActivityPickerTab === "material") {
      return;
    }
    if (visibleActivityCategories.some((category) => category.id === selectedActivityPickerTab)) {
      return;
    }
    setSelectedActivityPickerTab(visibleActivityCategories[0]?.id ?? "activity-banks");
  }, [selectedActivityPickerTab, visibleActivityCategories]);

  if (((authLoading || !course) && !canManage) || studentRedirectGroupId) {
    return (
      <AppShell>
        <main className="page stack">
          <p>{t("common.loading")}</p>
        </main>
      </AppShell>
    );
  }

  if (course && !canManage) {
    return (
      <AppShell>
        <main className="page stack">
          <section className="hero-panel hero-panel-compact">
            <div className="hero-meta">
              <p className="eyebrow">{t("courseDetail.groupsEyebrow")}</p>
              <h1>{course.title}</h1>
              <p className="muted">{t("courseDetail.noAvailableGroups")}</p>
            </div>
            <div className="hero-actions">
              <Link className="button secondary" href="/courses">
                {t("courseDetail.backToCourses")}
              </Link>
            </div>
          </section>
        </main>
      </AppShell>
    );
  }

  const materials = course?.materials ?? [];
  const contentFolderOptions = flattenContentItems(contentItems, new Set())
    .filter(({ item }) => item.kind === "folder")
    .map(({ item, depth }) => ({ item, depth }));
  const selectedPickerFolder = pickerParentId ? contentFolderOptions.find(({ item }) => item.id === pickerParentId) ?? null : null;
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
    selectedActivityPickerTab === "activity-banks" || selectedActivityPickerTab === "material"
      ? []
      : activityTypes.filter((type) => activityTypeBelongsToCategory(type.key, selectedActivityPickerTab));
  const pickerContentTypes = contentTypeDefinitions;
  const visibleContentItems = flattenContentItems(contentItems, collapsedContentFolderIds);
  const courseMaterialById = new Map(materials.map((material) => [material.id, material]));
  const contentResourceById = new Map(contentResources.map((resource) => [resource.id, resource]));
  const contentTypeByKey = new Map(activeContentTypeDefinitions.map((definition) => [definition.key, definition]));
  const courseActivityById = new Map((course?.activities ?? []).map((activity) => [activity.id, activity]));
  const courseGroupById = new Map((course?.groups ?? []).map((group) => [group.id, group]));
  const settingsContentItem = settingsContentItemId ? contentItems.find((item) => item.id === settingsContentItemId) ?? null : null;
  const settingsActivity = settingsContentItem?.activityId ? courseActivityById.get(settingsContentItem.activityId) ?? null : null;
  const settingsContentResource = settingsContentItem?.contentResourceId ? contentResourceById.get(settingsContentItem.contentResourceId) ?? null : null;
  const settingsContentType = settingsContentResource ? contentTypeByKey.get(settingsContentResource.contentTypeKey) ?? null : null;
  const SettingsContentTypeRenderer = resolveContentTypeSettingsRenderer(settingsContentType?.settingsRendererKey);

  function buildPickerContentPlacement(titleSnapshot?: string) {
    return {
      parentId: pickerParentId || null,
      isVisible: pickerIsVisible,
      metadata: {},
      ...(titleSnapshot ? { titleSnapshot } : {})
    };
  }

  function openActivityPicker(parentId: string | null = null) {
    setPickerParentId(parentId ?? "");
    setPickerIsVisible(true);
    setSelectedActivityPickerTab((current) => (current === "material" ? "activity-banks" : current));
    setShowActivityPicker(true);
    setContentContextMenu(null);
    setContentHeaderMenuOpen(false);
    setPickerFolderMenuOpen(false);
  }

  function expandAllContentFolders() {
    setCollapsedContentFolderIds(new Set());
    setContentHeaderMenuOpen(false);
  }

  function collapseAllContentFolders() {
    setCollapsedContentFolderIds(new Set(contentFolderOptions.map(({ item }) => item.id)));
    setContentHeaderMenuOpen(false);
  }

  function openContentContextMenu(item: CourseContentItem, event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setContentContextMenu({
      itemId: item.id,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 280))
    });
  }

  function openContentContextMenuFromButton(item: CourseContentItem, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (contentContextMenu?.itemId === item.id) {
      setContentContextMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setContentContextMenu({
      itemId: item.id,
      x: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 240)),
      y: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 280))
    });
  }

  function startEditingFolder(item: CourseContentItem, selectAll: boolean) {
    cancelFolderEditRef.current = false;
    skipFolderBlurRef.current = false;
    setEditingFolderId(item.id);
    setEditingFolderTitle(item.titleSnapshot ?? t("courseDetail.defaultFolderTitle"));
    setEditingFolderSelectAll(selectAll);
  }

  function cancelFolderEdit() {
    cancelFolderEditRef.current = true;
    setEditingFolderId(null);
    setEditingFolderTitle("");
    setEditingFolderSelectAll(false);
  }

  async function commitFolderEdit(item: CourseContentItem) {
    if (cancelFolderEditRef.current) {
      cancelFolderEditRef.current = false;
      return;
    }
    if (editingFolderId !== item.id) {
      return;
    }
    const nextTitle = editingFolderTitle.trim() || t("courseDetail.defaultFolderTitle");
    setEditingFolderId(null);
    setEditingFolderTitle("");
    setEditingFolderSelectAll(false);
    if (nextTitle === (item.titleSnapshot ?? "")) {
      return;
    }
    setMaterialActionError("");
    try {
      await updateContentInScope(item, { titleSnapshot: nextTitle });
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  function handleFolderTitleBlur(item: CourseContentItem) {
    if (skipFolderBlurRef.current) {
      skipFolderBlurRef.current = false;
      return;
    }
    void commitFolderEdit(item);
  }

  function handleFolderTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, item: CourseContentItem) {
    if (event.key === "Enter") {
      event.preventDefault();
      skipFolderBlurRef.current = true;
      void commitFolderEdit(item);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelFolderEdit();
    }
  }

  async function toggleContentVisibility(item: CourseContentItem) {
    setMaterialActionError("");
    try {
      await updateContentInScope(item, { isVisible: !item.isVisible });
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  async function removeContentItem(item: CourseContentItem) {
    const title = contentItemTitle(item);
    const confirmed = window.confirm(t("courseDetail.removeContentItemConfirm", { title }));
    if (!confirmed) {
      return;
    }

    setMaterialActionError("");
    try {
      if (item.activityId) {
        await api.deleteActivity(courseId, item.activityId);
      } else if (item.materialId) {
        await api.deleteMaterial(courseId, item.materialId);
      } else if (item.contentResourceId) {
        await api.deleteCourseContentResource(courseId, item.contentResourceId);
      } else {
        await deleteContentInScope(item);
      }
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  function openContentSettings(item: CourseContentItem) {
    setSettingsContentItemId(item.id);
    setSettingsError("");
    if (item.activityId) {
      const activity = courseActivityById.get(item.activityId);
      if (activity) {
        startAssigningActivityToAllGroups(activity);
      }
      return;
    }
    if (item.materialId) {
      setSettingsMaterialTitle(item.titleSnapshot ?? "");
      setSettingsMaterialUrl("");
      setSettingsMaterialBody("");
      setSettingsMaterialFile(null);
      return;
    }
    if (item.contentResourceId) {
      const resource = contentResourceById.get(item.contentResourceId);
      setSettingsMaterialTitle(resource?.title ?? item.titleSnapshot ?? "");
      setSettingsMaterialUrl(typeof resource?.metadata?.url === "string" ? resource.metadata.url : "");
      setSettingsMaterialBody(typeof resource?.metadata?.body === "string" ? resource.metadata.body : "");
      setSettingsMaterialFile(null);
    }
  }

  function closeContentSettings() {
    setSettingsContentItemId(null);
    setSettingsError("");
    setSettingsMaterialFile(null);
  }

  async function saveContentResourceSettings(event: FormEvent) {
    event.preventDefault();
    const item = settingsContentItemId ? contentItems.find((candidate) => candidate.id === settingsContentItemId) : null;
    const resource = item?.contentResourceId ? contentResourceById.get(item.contentResourceId) : null;
    if (!item || !resource) {
      return;
    }

    setSettingsError("");
    try {
      let nextTitle = settingsMaterialTitle;
      const definition = contentTypeByKey.get(resource.contentTypeKey);
      if (definition?.embeddingSource === "file_upload") {
        if (settingsMaterialFile) {
          nextTitle = settingsMaterialTitle || settingsMaterialFile.name;
          await api.uploadCourseContentResourceFile(courseId, resource.id, {
            title: nextTitle,
            file: settingsMaterialFile
          });
        } else if (typeof resource.metadata?.storedName === "string") {
          await api.updateCourseContentResource(courseId, resource.id, {
            payload: { title: settingsMaterialTitle }
          });
        } else {
          setSettingsError(t("courseDetail.chooseFile"));
          return;
        }
      } else if (definition?.embeddingSource === "text_body") {
        await api.updateCourseContentResource(courseId, resource.id, {
          payload: {
            title: settingsMaterialTitle,
            body: settingsMaterialBody
          }
        });
      } else {
        await api.updateCourseContentResource(courseId, resource.id, {
          payload: {
            title: settingsMaterialTitle,
            url: settingsMaterialUrl || undefined
          }
        });
      }
      await api.updateContentItem(courseId, item.id, { titleSnapshot: nextTitle });
      await refresh();
      closeContentSettings();
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : t("courseDetail.updateError"));
    }
  }

  async function updateContentInScope(
    item: CourseContentItem,
    input: { parentId?: string | null; isVisible?: boolean; position?: number; titleSnapshot?: string | null }
  ) {
    if (item.groupId) {
      await api.updateGroupContentItem(courseId, item.groupId, item.id, input);
    } else {
      await api.updateContentItem(courseId, item.id, input);
    }
  }

  async function deleteContentInScope(item: CourseContentItem) {
    if (item.groupId) {
      await api.deleteGroupContentItem(courseId, item.groupId, item.id);
    } else {
      await api.deleteContentItem(courseId, item.id);
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
    setMaterialActionError("");
    try {
      await action();
      await refresh();
    } catch (err) {
      setMaterialActionError(err instanceof Error ? err.message : t("courseDetail.contentUpdateError"));
    }
  }

  function nextContentPosition(parentId: string | null, groupId: string | null) {
    return contentItems.filter((item) => (item.parentId ?? null) === parentId && (item.groupId ?? null) === groupId).length;
  }

  function handleContentPointerDown(item: CourseContentItem, event: PointerEvent) {
    if (event.button !== 0) {
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
            setMaterialActionError(t("courseDetail.invalidFolderMove"));
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

  function contentItemTitle(item: CourseContentItem) {
    if (item.contentResourceId) {
      return contentResourceById.get(item.contentResourceId)?.title ?? item.titleSnapshot ?? t("courseDetail.untitledMaterial");
    }
    if (item.materialId) {
      return courseMaterialById.get(item.materialId)?.title ?? item.titleSnapshot ?? t("courseDetail.untitledMaterial");
    }
    if (item.activityId) {
      return courseActivityById.get(item.activityId)?.title ?? item.titleSnapshot ?? t("courseDetail.defaultActivityTitle");
    }
    return item.titleSnapshot ?? t("courseDetail.untitledFolder");
  }

  function contentItemHref(item: CourseContentItem) {
    if (item.activityId && courseActivityById.has(item.activityId)) {
      return `/courses/${courseId}/activities/${item.activityId}`;
    }
    if (item.materialId && courseMaterialById.has(item.materialId)) {
      return materialHref(courseMaterialById.get(item.materialId) as CourseMaterial) ?? null;
    }
    if (item.contentResourceId && contentResourceById.has(item.contentResourceId)) {
      const resource = contentResourceById.get(item.contentResourceId) as CourseContentResource;
      const definition = contentTypeByKey.get(resource.contentTypeKey);
      if (!definition) {
        return null;
      }
      if (definition.embeddingSource === "file_upload" && typeof resource.metadata?.storedName === "string") {
        return withContentResourceDownloadVersion(api.courseContentResourceDownloadUrl(courseId, resource.id), resource);
      }
      return typeof resource.metadata?.url === "string" ? resource.metadata.url : null;
    }
    return null;
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
              initialTab={searchParams.get("tab") === "gradebook" ? "gradebook" : "content"}
              tabs={[
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
                        <div className="section-actions content-header-actions">
                          <button
                            aria-expanded={contentHeaderMenuOpen}
                            aria-haspopup="menu"
                            aria-label={t("courseDetail.contentTreeActions")}
                            className="secondary icon-button section-action-icon-button"
                            title={t("courseDetail.contentTreeActionsTitle")}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setContentHeaderMenuOpen((current) => !current);
                            }}
                          >
                            <MaterialActionIcon name="more" />
                          </button>
                          {contentHeaderMenuOpen ? (
                            <div className="content-header-menu content-context-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                              <button
                                className="content-context-menu-item"
                                disabled={isAddingActivity}
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  setContentHeaderMenuOpen(false);
                                  void createInlineFolder(null);
                                }}
                              >
                                <MaterialActionIcon name="folderAdd" />
                                <span>{t("courseDetail.newRootFolderAction")}</span>
                              </button>
                              <button
                                className="content-context-menu-item"
                                role="menuitem"
                                type="button"
                                onClick={() => openActivityPicker(null)}
                              >
                                <MaterialActionIcon name="activityAdd" />
                                <span>{t("courseDetail.newRootActivityAction")}</span>
                              </button>
                              <button
                                className="content-context-menu-item"
                                disabled={!contentFolderOptions.length}
                                role="menuitem"
                                type="button"
                                onClick={expandAllContentFolders}
                              >
                                <MaterialActionIcon name="down" />
                                <span>{t("courseDetail.expandAllFolders")}</span>
                              </button>
                              <button
                                className="content-context-menu-item"
                                disabled={!contentFolderOptions.length}
                                role="menuitem"
                                type="button"
                                onClick={collapseAllContentFolders}
                              >
                                <MaterialActionIcon name="up" />
                                <span>{t("courseDetail.collapseAllFolders")}</span>
                              </button>
                            </div>
                          ) : null}
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
                            const isCollapsed = collapsedContentFolderIds.has(item.id);
                            const href = contentItemHref(item);
                            const material = item.materialId ? courseMaterialById.get(item.materialId) : null;
                            const materialIsDownloadable = material ? legacyMaterialHasStoredFile(material) : false;
                            const contentResource = item.contentResourceId ? contentResourceById.get(item.contentResourceId) : null;
                            const contentResourceDefinition = contentResource ? contentTypeByKey.get(contentResource.contentTypeKey) ?? null : null;
                            const contentResourceIsUnavailable = Boolean(contentResource && !contentResourceDefinition);
                            const contentResourceIsFile = contentResourceDefinition?.embeddingSource === "file_upload";
                            const activity = item.activityId ? courseActivityById.get(item.activityId) : null;
                            const allGroupsRule = activity ? getAllGroupsAssignmentRule(activity) : null;
                            const activityLabel = activity ? activityCopy(activity.activityType.key).name : null;
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
                                onContextMenu={(event) => openContentContextMenu(item, event)}
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
                                  {item.kind === "folder" && editingFolderId === item.id ? (
                                    <input
                                      ref={folderTitleInputRef}
                                      className="content-title-input"
                                      data-folder-id={item.id}
                                      value={editingFolderTitle}
                                      aria-label={t("courseDetail.renameFolder", { title })}
                                      onBlur={() => handleFolderTitleBlur(item)}
                                      onChange={(event) => setEditingFolderTitle(event.target.value)}
                                      onKeyDown={(event) => handleFolderTitleKeyDown(event, item)}
                                    />
                                  ) : (
                                    <strong>
                                      {href && material ? (
                                        <a
                                          href={href}
                                          rel={materialIsDownloadable ? undefined : "noreferrer"}
                                          target={materialIsDownloadable ? undefined : "_blank"}
                                        >
                                          {title}
                                        </a>
                                      ) : href && contentResource ? (
                                        <a href={href} rel={contentResourceIsFile ? undefined : "noreferrer"} target={contentResourceIsFile ? undefined : "_blank"}>
                                          {title}
                                        </a>
                                      ) : href ? (
                                        <Link href={href}>{title}</Link>
                                      ) : (
                                        title
                                      )}
                                    </strong>
                                  )}
                                  {activity || contentResourceIsUnavailable ? (
                                    <span className="metadata-badges">
                                      {activityLabel ? <span className="metadata-badge is-activity-type">{activityLabel}</span> : null}
                                      {activity?.activityVersion ? (
                                        <span className="metadata-badge">{`Bank version ${activity.activityVersion.versionNumber}`}</span>
                                      ) : null}
                                      {contentResourceIsUnavailable ? (
                                        <span className="metadata-badge is-warning">{t("courseDetail.contentPluginUnavailable")}</span>
                                      ) : null}
                                      {allGroupsRule?.enabled ? (
                                        <span className="metadata-badge is-course-wide">
                                          {t("courseDetail.assignedToAllGroups")} ·{" "}
                                          {formatAvailabilityWindow(allGroupsRule.availableFrom, allGroupsRule.availableUntil, t)}
                                        </span>
                                      ) : null}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="table-actions content-row-actions">
                                  {item.kind === "activity" && href ? (
                                    <Link
                                      aria-label={t("courseDetail.openActivity")}
                                      className="button secondary icon-button"
                                      href={href}
                                      title={t("courseDetail.openActivity")}
                                    >
                                      <MaterialActionIcon name="open" />
                                    </Link>
                                  ) : null}
                                  <button
                                    aria-label={t("courseDetail.contentActions", { title })}
                                    className="secondary icon-button"
                                    aria-expanded={contentContextMenu?.itemId === item.id}
                                    aria-haspopup="menu"
                                    title={t("courseDetail.contentActionsTitle")}
                                    type="button"
                                    onClick={(event) => openContentContextMenuFromButton(item, event)}
                                  >
                                    <MaterialActionIcon name="more" />
                                  </button>
                                </div>
                                {contentContextMenu?.itemId === item.id ? (
                                  <div
                                    className="content-context-menu"
                                    role="menu"
                                    style={{ left: contentContextMenu.x, top: contentContextMenu.y } as CSSProperties}
                                    onClick={(event) => event.stopPropagation()}
                                    onContextMenu={(event) => event.preventDefault()}
                                  >
                                    {href ? (
                                      material ? (
                                        <a
                                          className="content-context-menu-item"
                                          href={href}
                                          rel={materialIsDownloadable ? undefined : "noreferrer"}
                                          role="menuitem"
                                          target={materialIsDownloadable ? undefined : "_blank"}
                                          onClick={() => setContentContextMenu(null)}
                                        >
                                          <MaterialActionIcon name={materialIsDownloadable ? "download" : "open"} />
                                          <span>{t(materialIsDownloadable ? "common.download" : "common.open")}</span>
                                        </a>
                                      ) : contentResource ? (
                                        <a
                                          className="content-context-menu-item"
                                          href={href}
                                          rel={contentResourceIsFile ? undefined : "noreferrer"}
                                          role="menuitem"
                                          target={contentResourceIsFile ? undefined : "_blank"}
                                          onClick={() => setContentContextMenu(null)}
                                        >
                                          <MaterialActionIcon name={contentResourceIsFile ? "download" : "open"} />
                                          <span>{t(contentResourceIsFile ? "common.download" : "common.open")}</span>
                                        </a>
                                      ) : (
                                        <Link className="content-context-menu-item" href={href} role="menuitem" onClick={() => setContentContextMenu(null)}>
                                          <MaterialActionIcon name="open" />
                                          <span>{t("common.open")}</span>
                                        </Link>
                                      )
                                    ) : null}
                                    {item.kind === "folder" ? (
                                      <>
                                        <button
                                          className="content-context-menu-item"
                                          disabled={isAddingActivity}
                                          role="menuitem"
                                          type="button"
                                          onClick={() => openActivityPicker(item.id)}
                                        >
                                          <MaterialActionIcon name="activityAdd" />
                                          <span>{t("courseDetail.newActivityInFolder")}</span>
                                        </button>
                                        <button
                                          className="content-context-menu-item"
                                          disabled={isAddingActivity}
                                          role="menuitem"
                                          type="button"
                                          onClick={() => {
                                            setContentContextMenu(null);
                                            void createInlineFolder(item.id);
                                          }}
                                        >
                                          <MaterialActionIcon name="folderAdd" />
                                          <span>{t("courseDetail.newFolderInFolder")}</span>
                                        </button>
                                      </>
                                    ) : null}
                                    <button
                                      className="content-context-menu-item"
                                      role="menuitem"
                                      type="button"
                                      onClick={() => {
                                        setContentContextMenu(null);
                                        item.kind === "folder" ? startEditingFolder(item, false) : openContentSettings(item);
                                      }}
                                    >
                                      <MaterialActionIcon name="edit" />
                                      <span>{t(item.kind === "folder" ? "courseDetail.renameFolderAction" : "courseDetail.contentSettingsAction")}</span>
                                    </button>
                                    <button
                                      className="content-context-menu-item"
                                      role="menuitem"
                                      type="button"
                                      onClick={() => {
                                        setContentContextMenu(null);
                                        void toggleContentVisibility(item);
                                      }}
                                    >
                                      <MaterialActionIcon name={item.isVisible ? "hidden" : "visible"} />
                                      <span>{item.isVisible ? t("courseDetail.contentHidden") : t("courseDetail.contentVisible")}</span>
                                    </button>
                                    <button
                                      className="content-context-menu-item is-danger"
                                      role="menuitem"
                                      type="button"
                                      onClick={() => {
                                        setContentContextMenu(null);
                                        void removeContentItem(item);
                                      }}
                                    >
                                      <MaterialActionIcon name="remove" />
                                      <span>{t("common.remove")}</span>
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="muted">{t("courseDetail.noContentItems")}</p>
                      )}
                      {materialActionError ? <p className="error">{materialActionError}</p> : null}
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
                            <div className="table-group" key={activity.activityId}>
                              <div className="table-row table-row-gradebook-activity">
                                <div className="gradebook-activity-cell">
                                  <button
                                    aria-expanded={expandedGradebookActivityIds.has(activity.activityId)}
                                    aria-label={t("courseDetail.expandActivity", { title: activity.activityTitle })}
                                    className="gradebook-expander"
                                    type="button"
                                    onClick={() => toggleGradebookActivity(activity.activityId)}
                                  >
                                    {expandedGradebookActivityIds.has(activity.activityId) ? "▾" : "▸"}
                                  </button>
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
                                    disabled={savingReleaseItemId === activity.gradebookItemIds.join(":")}
                                    type="button"
                                    onClick={() =>
                                      setGradebookItemsRelease(activity.gradebookItemIds, !activity.allGradesReleased, activity.activityTitle)
                                    }
                                  >
                                    {activity.allGradesReleased ? t("courseDetail.hideGrades") : t("courseDetail.releaseGrades")}
                                  </button>
                                </div>
                                <div className="table-actions">
                                  <Link className="button secondary" href={`/courses/${courseId}/gradebook/activities/${activity.activityId}`}>
                                    {t("courseDetail.detailedResults")}
                                  </Link>
                                </div>
                              </div>
                              {expandedGradebookActivityIds.has(activity.activityId) ? (
                                <div className="gradebook-subtable">
                                  {activity.groups.map((group) => (
                                    <div className="table-row table-row-gradebook-group-summary" key={`${activity.activityId}-${group.groupId}`}>
                                      <div className="table-main table-main-stack">
                                        <strong>{group.groupTitle}</strong>
                                        <span className="table-meta-note muted">{t("courseDetail.studentCount", { count: group.studentCount })}</span>
                                      </div>
                                      <span className="gradebook-number">{group.submissionCount}</span>
                                      <span className="gradebook-number">{group.gradedCount}</span>
                                      <strong className="gradebook-number">{formatMeanGrade(group.meanScore, group.meanMaxScore)}</strong>
                                      <div className="table-actions">
                                        <button
                                          className="button secondary"
                                          disabled={savingReleaseItemId === group.gradebookItemId}
                                          type="button"
                                          onClick={() => setGradebookRelease(group.gradebookItemId, !group.gradesReleased, `${activity.activityTitle} - ${group.groupTitle}`)}
                                        >
                                          {group.gradesReleased ? t("courseDetail.hideGrades") : t("courseDetail.releaseGrades")}
                                        </button>
                                      </div>
                                      <div className="table-actions">
                                        <Link
                                          className="button secondary"
                                          href={`/courses/${courseId}/gradebook/activities/${activity.activityId}?groupId=${group.groupId}`}
                                        >
                                          {t("courseDetail.detailedResults")}
                                        </Link>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
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
            {settingsContentItem ? (
              <div className="dialog-backdrop" role="presentation">
                <section
                  aria-labelledby="course-content-settings-title"
                  aria-modal="true"
                  className="dialog-panel"
                  role="dialog"
                >
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{t("courseDetail.contentSettingsEyebrow")}</p>
                      <h2 id="course-content-settings-title">{contentItemTitle(settingsContentItem)}</h2>
                    </div>
                    <button className="secondary icon-button" onClick={closeContentSettings} title={t("common.cancel")} type="button">
                      <CloseIcon />
                    </button>
                  </div>

                  {settingsActivity ? (
                    <form className="form" onSubmit={assignActivityToAllGroups}>
                      <div className="grid compact-form-grid">
                        <div className="field">
                          <label htmlFor={`settings-assign-folder-${settingsActivity.id}`}>{t("courseDetail.contentFolderLabel")}</label>
                          <select
                            id={`settings-assign-folder-${settingsActivity.id}`}
                            value={assignAllParentId}
                            disabled={assignAllSavingActivityId === settingsActivity.id}
                            onChange={(event) => setAssignAllParentId(event.target.value)}
                          >
                            <option value="">{t("courseDetail.contentFolderRoot")}</option>
                            {contentFolderOptions.map(({ item: folder, depth }) => (
                              <option key={folder.id} value={folder.id}>
                                {formatFolderOptionLabel(folder, depth, t("courseDetail.untitledFolder"))}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`settings-assign-from-${settingsActivity.id}`}>{t("groupPage.availableFrom")}</label>
                          <DateTimeMinuteInput
                            id={`settings-assign-from-${settingsActivity.id}`}
                            value={assignAllAvailableFrom}
                            onChange={setAssignAllAvailableFrom}
                            disabled={assignAllSavingActivityId === settingsActivity.id}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`settings-assign-until-${settingsActivity.id}`}>{t("groupPage.availableUntil")}</label>
                          <DateTimeMinuteInput
                            id={`settings-assign-until-${settingsActivity.id}`}
                            value={assignAllAvailableUntil}
                            onChange={setAssignAllAvailableUntil}
                            disabled={assignAllSavingActivityId === settingsActivity.id}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`settings-assign-mode-${settingsActivity.id}`}>{t("groupPage.assessmentMode")}</label>
                          <select
                            id={`settings-assign-mode-${settingsActivity.id}`}
                            value={assignAllAssessmentMode}
                            disabled={assignAllSavingActivityId === settingsActivity.id}
                            onChange={(event) => setAssignAllAssessmentMode(event.target.value as "formative" | "summative")}
                          >
                            <option value="formative">{t("groupPage.assessmentModeFormative")}</option>
                            <option value="summative">{t("groupPage.assessmentModeSummative")}</option>
                          </select>
                        </div>
                      </div>
                      <label className="checkbox-row" htmlFor={`settings-assign-visible-${settingsActivity.id}`}>
                        <input
                          id={`settings-assign-visible-${settingsActivity.id}`}
                          type="checkbox"
                          checked={assignAllIsVisible}
                          disabled={assignAllSavingActivityId === settingsActivity.id}
                          onChange={(event) => setAssignAllIsVisible(event.target.checked)}
                        />
                        <span>{t("courseDetail.contentVisibleLabel")}</span>
                      </label>
                      <label className="checkbox-row" htmlFor={`settings-assign-overrides-${settingsActivity.id}`}>
                        <input
                          id={`settings-assign-overrides-${settingsActivity.id}`}
                          type="checkbox"
                          checked={assignAllEnablePerGroupSettings}
                          disabled={assignAllSavingActivityId === settingsActivity.id}
                          onChange={(event) => setAssignAllEnablePerGroupSettings(event.target.checked)}
                        />
                        <span>{t("courseDetail.enablePerGroupSettings")}</span>
                      </label>
                      {assignAllAssessmentMode === "summative" ? (
                        <div className="grid compact-form-grid">
                          <div className="field">
                            <label htmlFor={`settings-assign-points-${settingsActivity.id}`}>{t("groupPage.pointsPossible")}</label>
                            <input
                              id={`settings-assign-points-${settingsActivity.id}`}
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={assignAllPointsPossible}
                              disabled={assignAllSavingActivityId === settingsActivity.id}
                              onChange={(event) => setAssignAllPointsPossible(event.target.value)}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`settings-assign-grading-mode-${settingsActivity.id}`}>{t("groupPage.gradingMode")}</label>
                            <select
                              id={`settings-assign-grading-mode-${settingsActivity.id}`}
                              value={assignAllGradingMode}
                              disabled={assignAllSavingActivityId === settingsActivity.id}
                              onChange={(event) => setAssignAllGradingMode(event.target.value as "points" | "pass_fail")}
                            >
                              <option value="points">{t("groupPage.gradingModePoints")}</option>
                              <option value="pass_fail">{t("groupPage.gradingModePassFail")}</option>
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`settings-assign-attempt-mode-${settingsActivity.id}`}>{t("groupPage.attemptLimitMode")}</label>
                            <select
                              id={`settings-assign-attempt-mode-${settingsActivity.id}`}
                              value={assignAllAttemptLimitMode}
                              disabled={assignAllSavingActivityId === settingsActivity.id}
                              onChange={(event) => setAssignAllAttemptLimitMode(event.target.value as "unlimited" | "max_attempts" | "until_due")}
                            >
                              <option value="unlimited">{t("groupPage.attemptLimitUnlimited")}</option>
                              <option value="max_attempts">{t("groupPage.attemptLimitMax")}</option>
                              <option value="until_due">{t("groupPage.attemptLimitUntilDue")}</option>
                            </select>
                          </div>
                          {assignAllGradingMode === "pass_fail" ? (
                            <>
                              <div className="field">
                                <label htmlFor={`settings-assign-pass-points-${settingsActivity.id}`}>{t("groupPage.passThresholdPoints")}</label>
                                <input
                                  id={`settings-assign-pass-points-${settingsActivity.id}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={assignAllPassThresholdPoints}
                                  disabled={assignAllSavingActivityId === settingsActivity.id}
                                  onChange={(event) => setAssignAllPassThresholdPoints(event.target.value)}
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`settings-assign-pass-out-of-${settingsActivity.id}`}>{t("groupPage.passThresholdOutOf")}</label>
                                <input
                                  id={`settings-assign-pass-out-of-${settingsActivity.id}`}
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={assignAllPassThresholdOutOf}
                                  disabled={assignAllSavingActivityId === settingsActivity.id}
                                  onChange={(event) => setAssignAllPassThresholdOutOf(event.target.value)}
                                />
                              </div>
                            </>
                          ) : null}
                          {assignAllAttemptLimitMode === "max_attempts" ? (
                            <div className="field">
                              <label htmlFor={`settings-assign-max-attempts-${settingsActivity.id}`}>{t("groupPage.maxAttempts")}</label>
                              <input
                                id={`settings-assign-max-attempts-${settingsActivity.id}`}
                                type="number"
                                min="1"
                                step="1"
                                value={assignAllMaxAttempts}
                                disabled={assignAllSavingActivityId === settingsActivity.id}
                                onChange={(event) => setAssignAllMaxAttempts(event.target.value)}
                              />
                            </div>
                          ) : null}
                          <div className="field">
                            <label htmlFor={`settings-assign-grade-strategy-${settingsActivity.id}`}>{t("groupPage.gradeStrategy")}</label>
                            <select
                              id={`settings-assign-grade-strategy-${settingsActivity.id}`}
                              value={assignAllGradeStrategy}
                              disabled={assignAllSavingActivityId === settingsActivity.id}
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
                            <label className="checkbox-row" htmlFor={`settings-assign-drop-lowest-${settingsActivity.id}`}>
                              <input
                                id={`settings-assign-drop-lowest-${settingsActivity.id}`}
                                type="checkbox"
                                checked={assignAllDropLowestAttempt}
                                disabled={assignAllSavingActivityId === settingsActivity.id}
                                onChange={(event) => setAssignAllDropLowestAttempt(event.target.checked)}
                              />
                              <span>{t("groupPage.dropLowestAttempt")}</span>
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                      {settingsError ? <p className="error">{settingsError}</p> : null}
                      <div className="row">
                        <button disabled={assignAllSavingActivityId === settingsActivity.id} type="submit">
                          {assignAllSavingActivityId === settingsActivity.id ? t("common.saving") : t("courseDetail.assignAllGroupsSave")}
                        </button>
                        {getAllGroupsAssignmentRule(settingsActivity)?.enabled ? (
                          <button
                            className="danger"
                            disabled={assignAllSavingActivityId === settingsActivity.id}
                            type="button"
                            onClick={() => removeActivityFromAllGroupsPolicy(settingsActivity)}
                          >
                            {t("courseDetail.removeAllGroupsPolicy")}
                          </button>
                        ) : null}
                        <Link className="button secondary" href={`/courses/${courseId}/activities/${settingsActivity.id}`}>
                          {t("courseDetail.openActivity")}
                        </Link>
                      </div>
                    </form>
                  ) : settingsContentResource && settingsContentType && SettingsContentTypeRenderer ? (
                    SettingsContentTypeRenderer({
                      definition: settingsContentType,
                      contentItem: settingsContentItem ?? undefined,
                      resource: settingsContentResource,
                      locale,
                      settings: {
                        title: settingsMaterialTitle,
                        url: settingsMaterialUrl,
                        body: settingsMaterialBody,
                        detail: contentResourceDetail(settingsContentResource),
                        error: settingsError,
                        onTitleChange: setSettingsMaterialTitle,
                        onUrlChange: setSettingsMaterialUrl,
                        onBodyChange: setSettingsMaterialBody,
                        onFileChange: setSettingsMaterialFile,
                        onSubmit: saveContentResourceSettings
                      },
                      t
                    })
                  ) : (
                    <p className="muted">{t("courseDetail.contentSettingsUnavailable")}</p>
                  )}
                </section>
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
                      {activityPickerTabs.map((tab) => (
                        <button
                          key={tab.id}
                          aria-selected={selectedActivityPickerTab === tab.id}
                          className={selectedActivityPickerTab === tab.id ? "activity-category-tab is-active" : "activity-category-tab"}
                          onClick={() => setSelectedActivityPickerTab(tab.id)}
                          role="tab"
                          type="button"
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="activity-type-options" role="tabpanel">
                      <div className="grid compact-form-grid activity-picker-placement">
                        <div className="field">
                          <span className="field-label" id="course-content-folder-label">
                            {t("courseDetail.contentFolderLabel")}
                          </span>
                          <div className="folder-picker">
                            <button
                              aria-expanded={pickerFolderMenuOpen}
                              aria-haspopup="listbox"
                              aria-labelledby="course-content-folder-label course-content-folder-current"
                              className="folder-picker-trigger"
                              id="courseContentFolder"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPickerFolderMenuOpen((current) => !current);
                              }}
                            >
                              <span className="folder-picker-current" id="course-content-folder-current">
                                {selectedPickerFolder
                                  ? selectedPickerFolder.item.titleSnapshot ?? t("courseDetail.untitledFolder")
                                  : t("courseDetail.contentFolderRoot")}
                              </span>
                              <MaterialActionIcon name="down" />
                            </button>
                            {pickerFolderMenuOpen ? (
                              <div
                                className="folder-picker-menu"
                                role="listbox"
                                aria-labelledby="course-content-folder-label"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  aria-selected={!pickerParentId}
                                  className={!pickerParentId ? "folder-picker-option is-selected" : "folder-picker-option"}
                                  role="option"
                                  style={{ "--folder-picker-depth": 0 } as CSSProperties}
                                  type="button"
                                  onClick={() => {
                                    setPickerParentId("");
                                    setPickerFolderMenuOpen(false);
                                  }}
                                >
                                  <span className="folder-picker-tree-rails" aria-hidden="true" />
                                  <span className="folder-picker-folder-icon">
                                    <MaterialActionIcon name="folder" />
                                  </span>
                                  <span className="folder-picker-option-label">{t("courseDetail.contentFolderRoot")}</span>
                                </button>
                                {contentFolderOptions.map(({ item: folder, depth }) => (
                                  <button
                                    key={folder.id}
                                    aria-selected={pickerParentId === folder.id}
                                    className={pickerParentId === folder.id ? "folder-picker-option is-selected" : "folder-picker-option"}
                                    role="option"
                                    style={{ "--folder-picker-depth": depth } as CSSProperties}
                                    type="button"
                                    onClick={() => {
                                      setPickerParentId(folder.id);
                                      setPickerFolderMenuOpen(false);
                                    }}
                                  >
                                    <span className="folder-picker-tree-rails" aria-hidden="true" />
                                    <span className="folder-picker-folder-icon">
                                      <MaterialActionIcon name="folder" />
                                    </span>
                                    <span className="folder-picker-option-label">{folder.titleSnapshot ?? t("courseDetail.untitledFolder")}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <label className="checkbox-row" htmlFor="courseContentVisible">
                          <input
                            id="courseContentVisible"
                            type="checkbox"
                            checked={pickerIsVisible}
                            onChange={(event) => setPickerIsVisible(event.target.checked)}
                          />
                          <span>{t("courseDetail.contentVisibleLabel")}</span>
                        </label>
                      </div>
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
                      ) : selectedActivityPickerTab === "material" ? (
                        <div className="activity-type-picker-grid">
                          {pickerContentTypes.map((contentType) => (
                            <button
                              key={contentType.key}
                              className="activity-type-option"
                              disabled={isAddingActivity}
                              onClick={() => createPickerContentResource(contentType)}
                              type="button"
                            >
                              <MaterialTypeIcon iconName={contentType.icon} />
                              <span>
                                <strong>{resolveLocalizedText(contentType.label, locale)}</strong>
                                <small>{resolveLocalizedText(contentType.description, locale)}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <>
                        {activityDefinitions.some((definition) => definition.key === "test" && definition.provider?.kind === "core") ? (
                          <button
                            className="activity-type-option"
                            disabled={isAddingActivity}
                            onClick={createLocalTest}
                            type="button"
                          >
                            <ActivityTypeIcon iconName="document-check" />
                            <span>
                              <strong>{activityDefinitions.find((definition) => definition.key === "test")?.i18n?.[locale]?.name ?? "Test"}</strong>
                              <small>{activityDefinitions.find((definition) => definition.key === "test")?.i18n?.[locale]?.description ?? "A summative assessment composed of activities."}</small>
                            </span>
                          </button>
                        ) : null}
                        {visibleActivityTypes.map((type) => (
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
                        ))}
                        </>
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
    contentPlacement: parseContentPlacement(record.contentPlacement),
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

function parseContentPlacement(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    parentId: typeof record.parentId === "string" ? record.parentId : null,
    isVisible: record.isVisible !== false
  };
}

function withMaterialDownloadVersion(url: string, material: CourseMaterial) {
  const version =
    typeof material.metadata?.storedName === "string"
      ? material.metadata.storedName
      : typeof material.metadata?.originalName === "string"
        ? material.metadata.originalName
        : null;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function legacyMaterialHasStoredFile(material: CourseMaterial) {
  return typeof material.metadata?.storedName === "string";
}

function withContentResourceDownloadVersion(url: string, resource: CourseContentResource) {
  const version =
    typeof resource.metadata?.storedName === "string"
      ? resource.metadata.storedName
      : typeof resource.metadata?.originalName === "string"
        ? resource.metadata.originalName
        : null;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
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

function formatMeanGrade(score: number | null, maxScore: number | null) {
  if (score === null || maxScore === null) {
    return "-";
  }
  return `${formatGradeNumber(score)} / ${formatGradeNumber(maxScore)}`;
}

type GradebookGroupSummary = {
  groupId: string;
  groupTitle: string;
  gradebookItemId: string;
  gradesReleased: boolean;
  studentCount: number;
  submissionCount: number;
  gradedCount: number;
  meanScore: number | null;
  meanMaxScore: number | null;
};

type GradebookActivitySummary = {
  activityId: string;
  activityTitle: string;
  activityTypeName: string;
  gradebookItemIds: string[];
  allGradesReleased: boolean;
  submissionCount: number;
  gradedCount: number;
  meanScore: number | null;
  meanMaxScore: number | null;
  groups: GradebookGroupSummary[];
};

function buildGradebookActivitySummaries(items: CourseGradebookItemSummary[], rows: CourseGradebookRow[]): GradebookActivitySummary[] {
  const rowsByItem = new Map<string, CourseGradebookRow[]>();
  for (const row of rows) {
    const existing = rowsByItem.get(row.gradebookItemId) ?? [];
    existing.push(row);
    rowsByItem.set(row.gradebookItemId, existing);
  }

  const itemsByActivity = new Map<string, CourseGradebookItemSummary[]>();
  for (const item of items) {
    const existing = itemsByActivity.get(item.activityId) ?? [];
    existing.push(item);
    itemsByActivity.set(item.activityId, existing);
  }

  return [...itemsByActivity.values()]
    .map((activityItems) => {
      const first = activityItems[0];
      const activityRows = activityItems.flatMap((item) => rowsByItem.get(item.gradebookItemId) ?? []);
      const groups = activityItems
        .map((item) => summarizeGradebookGroup(item, rowsByItem.get(item.gradebookItemId) ?? []))
        .sort((left, right) => left.groupTitle.localeCompare(right.groupTitle));

      return {
        activityId: first.activityId,
        activityTitle: first.activityTitle,
        activityTypeName: first.activityTypeName,
        gradebookItemIds: activityItems.map((item) => item.gradebookItemId),
        allGradesReleased: groups.length > 0 && groups.every((group) => group.gradesReleased),
        submissionCount: sum(groups.map((group) => group.submissionCount)),
        gradedCount: sum(groups.map((group) => group.gradedCount)),
        ...meanGradeForRows(activityRows),
        groups
      };
    })
    .sort((left, right) => left.activityTitle.localeCompare(right.activityTitle));
}

function summarizeGradebookGroup(item: CourseGradebookItemSummary, rows: CourseGradebookRow[]): GradebookGroupSummary {
  return {
    groupId: item.groupId,
    groupTitle: item.groupTitle,
    gradebookItemId: item.gradebookItemId,
    gradesReleased: item.gradesReleased,
    studentCount: item.studentCount,
    submissionCount: sum(rows.map((row) => row.submittedAttemptCount)),
    gradedCount: rows.filter((row) => row.score !== null).length,
    ...meanGradeForRows(rows)
  };
}

function buildGradebookOverview(activities: GradebookActivitySummary[]) {
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
  name:
    | "activityAdd"
    | "add"
    | "assign"
    | "download"
    | "down"
    | "drag"
    | "edit"
    | "folder"
    | "folderAdd"
    | "hidden"
    | "more"
    | "open"
    | "remove"
    | "up"
    | "visible";
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
    add: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
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
        <path d="m4 16 1 4 4-1 9-9-5-5-9 9Z" />
        <path d="m12 6 5 5" />
      </>
    ),
    folder: (
      <>
        <path d="M3 7.5h6.7l2 2.5H21v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
        <path d="M3 10h18" />
      </>
    ),
    folderAdd: (
      <>
        <path d="M3 7h7l2 3h9v9H3z" />
        <path d="M15 12v5" />
        <path d="M12.5 14.5h5" />
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
    more: (
      <>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
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
  };

  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      {paths[name]}
    </svg>
  );
}
