"use client";

import {
  activityDefinitionBelongsToCategory,
  activityDefinitionCreatesCategory,
  listActivityCategories,
  type ActivityCategoryId
} from "@cognelo/activity-sdk/categories";
import { ActivityVersionDiffView, ConfirmationDialog, ContextMenu } from "@cognelo/activity-ui";
import type { ActivityVersionDiff } from "@cognelo/contracts";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityTypeIcon, AppIcon, FolderContentIcon } from "@/components/app-icon";
import {
  api,
  ApiError,
  type ActivityBank,
  type ActivityBankFolder,
  type ActivityDefinition,
  type ActivityType,
  type BankActivity
} from "@/lib/api";
import { defaultDuplicateBankActivityTitle } from "@/lib/activity-bank-titles";
import { useI18n } from "@/lib/i18n";

type EditingActivityState = {
  id: string;
  title: string;
  description: string;
  lifecycle: "draft" | "published" | "paused" | "archived";
  activityTypeKey: string;
};

type DeleteActivityState = { activity: BankActivity; courseCount: number | null };
type BankTreeItem =
  | { id: string; kind: "folder"; parentId: string | null; position: number; title: string; folder: ActivityBankFolder }
  | { id: string; kind: "activity"; parentId: string | null; position: number; title: string; activity: BankActivity };
type BankDropPlacement = "before" | "inside" | "after";
type BankDropTarget = { id: "root"; type: "root" } | { id: string; placement: BankDropPlacement; type: "item" };

const activityCategories = listActivityCategories();
type I18nTranslate = ReturnType<typeof useI18n>["t"];

export default function ActivityBankDetailPage() {
  const params = useParams<{ activityBankId: string }>();
  const router = useRouter();
  const activityBankId = params.activityBankId;
  const { locale, t } = useI18n();
  const [bank, setBank] = useState<ActivityBank | null>(null);
  const [activityBanks, setActivityBanks] = useState<ActivityBank[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [editingActivity, setEditingActivity] = useState<EditingActivityState | null>(null);
  const [error, setError] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [publishingActivityId, setPublishingActivityId] = useState<string | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [duplicatingActivityId, setDuplicatingActivityId] = useState<string | null>(null);
  const [duplicatingActivity, setDuplicatingActivity] = useState<BankActivity | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [movingActivity, setMovingActivity] = useState<BankActivity | null>(null);
  const [moveTargetBankId, setMoveTargetBankId] = useState("");
  const [activityActionMenuId, setActivityActionMenuId] = useState<string | null>(null);
  const [activityActionMenuAnchor, setActivityActionMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [deleteActivityState, setDeleteActivityState] = useState<DeleteActivityState | null>(null);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [activityPickerFolderId, setActivityPickerFolderId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<ActivityCategoryId>("generic");
  const [comparingActivity, setComparingActivity] = useState<BankActivity | null>(null);
  const [fromVersionId, setFromVersionId] = useState("");
  const [toVersionId, setToVersionId] = useState("");
  const [versionDiff, setVersionDiff] = useState<ActivityVersionDiff | null>(null);
  const [versionDiffLoading, setVersionDiffLoading] = useState(false);
  const [versionDiffError, setVersionDiffError] = useState("");
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderTitle, setEditingFolderTitle] = useState("");
  const [editingFolderSelectAll, setEditingFolderSelectAll] = useState(false);
  const [folderActionMenuId, setFolderActionMenuId] = useState<string | null>(null);
  const [folderActionMenuAnchor, setFolderActionMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [folderActionMenuPoint, setFolderActionMenuPoint] = useState<{ x: number; y: number } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ActivityBankFolder | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ title: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<BankDropTarget | null>(null);
  const [showConceptFilter, setShowConceptFilter] = useState(false);
  const [selectedConceptIds, setSelectedConceptIds] = useState<Set<string>>(new Set());
  const [draftConceptIds, setDraftConceptIds] = useState<Set<string>>(new Set());
  const folderTitleInputRef = useRef<HTMLInputElement | null>(null);
  const cancelFolderEditRef = useRef(false);
  const skipFolderBlurRef = useRef(false);

  async function loadPage() {
    const [bankResult, typesResult, banksResult] = await Promise.all([api.activityBank(activityBankId), api.activityTypes(), api.activityBanks()]);
    setBank(bankResult.activityBank);
    setActivityBanks(banksResult.activityBanks);
    setActivityTypes(typesResult.activityTypes);
    setActivityDefinitions(typesResult.registeredDefinitions);
  }

  useEffect(() => {
    loadPage().catch((err) => setError(err instanceof Error ? err.message : t("activityBankDetail.loadError")));
  }, [activityBankId]);

  useEffect(() => {
    if (!showActivityPicker && !showConceptFilter) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowActivityPicker(false);
        setShowConceptFilter(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showActivityPicker, showConceptFilter]);

  useEffect(() => {
    if (!editingFolderId) return;
    const frame = window.requestAnimationFrame(() => {
      const input = folderTitleInputRef.current;
      if (!input || input.dataset.folderId !== editingFolderId) return;
      input.focus();
      if (editingFolderSelectAll) input.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingFolderId, editingFolderSelectAll, bank]);

  async function createBankActivity(selectedActivityTypeKey: string) {
    if (!bank) {
      return;
    }
    setSavingActivity(true);
    setError("");
    try {
      const definition = activityDefinitions.find((candidate) => candidate.key === selectedActivityTypeKey);
      const localized = definition?.i18n?.[locale];
      const input = {
        title: localized?.defaultTitle ?? definition?.name ?? activityTypeLabel(selectedActivityTypeKey),
        description: localized?.description ?? definition?.description ?? "",
        lifecycle: "draft" as const,
        position: nextBankItemPosition(activityPickerFolderId),
        folderId: activityPickerFolderId
      };
      const bankActivityId = selectedActivityTypeKey === "test"
        ? (await api.createBankTest(bank.id, input)).test.bankActivityId
        : (await api.createBankActivity(bank.id, {
            ...input,
            activityTypeKey: selectedActivityTypeKey,
            config: definition?.defaultConfig ?? {},
            metadata: {}
          })).activity.id;
      setShowActivityPicker(false);
      await loadPage();
      router.push(`/activity-banks/${bank.id}/activities/${bankActivityId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.createActivityError"));
    } finally {
      setSavingActivity(false);
    }
  }

  async function saveActivityEdit(event: FormEvent) {
    event.preventDefault();
    if (!bank || !editingActivity) {
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      if (editingActivity.activityTypeKey === "test") {
        await api.updateBankTest(bank.id, editingActivity.id, {
          title: editingActivity.title,
          description: editingActivity.description,
          lifecycle: editingActivity.lifecycle
        });
      } else {
        await api.updateBankActivity(bank.id, editingActivity.id, {
          title: editingActivity.title,
          description: editingActivity.description,
          lifecycle: editingActivity.lifecycle,
          activityTypeKey: editingActivity.activityTypeKey
        });
      }
      setEditingActivity(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.updateActivityError"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function publishActivity(activity: BankActivity) {
    if (!bank || publishingActivityId) return;
    setActivityActionMenuId(null);
    setActivityActionMenuAnchor(null);
    setPublishingActivityId(activity.id);
    setError("");
    try {
      if (activity.activityType.key === "test") await api.updateBankTest(bank.id, activity.id, { lifecycle: "published" });
      else await api.updateBankActivity(bank.id, activity.id, { lifecycle: "published" });
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.publishActivityError"));
    } finally {
      setPublishingActivityId(null);
    }
  }

  async function confirmDeleteActivity() {
    if (!bank || !deleteActivityState) {
      return;
    }
    const { activity, courseCount } = deleteActivityState;
    setDeletingActivityId(activity.id);
    setError("");
    try {
      await api.deleteBankActivity(bank.id, activity.id, courseCount === null ? undefined : { force: true });
      setDeleteActivityState(null);
      await loadPage();
    } catch (err) {
      if (courseCount === null && err instanceof ApiError && err.code === "BANK_ACTIVITY_IN_USE") {
        setDeleteActivityState({ activity, courseCount: getCourseCountFromDeleteError(err.details) });
        return;
      }

      setError(err instanceof Error ? err.message : t("activityBankDetail.deleteActivityError"));
    } finally {
      setDeletingActivityId(null);
    }
  }

  async function duplicateActivity(event: FormEvent) {
    event.preventDefault();
    if (!bank || !duplicatingActivity) return;
    setDuplicatingActivityId(duplicatingActivity.id);
    setError("");
    try {
      await api.duplicateBankActivity(bank.id, duplicatingActivity.id, duplicateTitle);
      setDuplicatingActivity(null);
      setDuplicateTitle("");
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.duplicateActivityError"));
    } finally {
      setDuplicatingActivityId(null);
    }
  }

  async function moveActivity(event: FormEvent) {
    event.preventDefault();
    if (!bank || !movingActivity || !moveTargetBankId) return;
    setSavingEdit(true);
    setError("");
    try {
      await api.moveBankActivity(bank.id, movingActivity.id, moveTargetBankId);
      setMovingActivity(null);
      setMoveTargetBankId("");
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.moveActivityError"));
    } finally {
      setSavingEdit(false);
    }
  }

  function openVersionComparison(activity: BankActivity) {
    const versions = activity.versions ?? [];
    setActivityActionMenuId(null);
    setComparingActivity(activity);
    setFromVersionId(versions[1]?.id ?? "");
    setToVersionId(versions[0]?.id ?? "");
    setVersionDiff(null);
    setVersionDiffError("");
  }

  async function compareVersions() {
    if (!comparingActivity || !fromVersionId || !toVersionId || fromVersionId === toVersionId) return;
    setVersionDiffLoading(true);
    setVersionDiffError("");
    try {
      const result = await api.compareBankActivityVersions(activityBankId, comparingActivity.id, fromVersionId, toVersionId);
      setVersionDiff(result.diff);
    } catch (err) {
      setVersionDiffError(err instanceof Error ? err.message : t("bankActivityPage.versionDiffError"));
    } finally {
      setVersionDiffLoading(false);
    }
  }

  function openActivityPicker(parentId: string | null = null) {
    setActivityPickerFolderId(parentId);
    setShowActivityPicker(true);
    setFolderActionMenuId(null);
    setFolderActionMenuAnchor(null);
    setFolderActionMenuPoint(null);
  }

  async function createInlineFolder(parentId: string | null) {
    if (!bank) return;
    setSavingFolder(true);
    setError("");
    try {
      const title = t("activityBankDetail.defaultFolderTitle");
      const result = await api.createActivityBankFolder(bank.id, { title, parentId, position: 0 });
      const siblings = bankTreeItems
        .filter((item) => item.id !== result.folder.id && item.parentId === parentId)
        .sort(compareBankTreeItems);
      await Promise.all([
        api.updateActivityBankFolder(bank.id, result.folder.id, { position: 0 }),
        ...siblings.map((item, index) => updateBankTreeItem(item, { parentId, position: index + 1 }))
      ]);
      if (parentId) {
        setCollapsedFolderIds((current) => {
          const next = new Set(current);
          next.delete(parentId);
          return next;
        });
      }
      startEditingFolder(result.folder, true);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.createFolderError"));
    } finally {
      setSavingFolder(false);
    }
  }

  function startEditingFolder(folder: ActivityBankFolder, selectAll: boolean) {
    cancelFolderEditRef.current = false;
    skipFolderBlurRef.current = false;
    setEditingFolderId(folder.id);
    setEditingFolderTitle(folder.title);
    setEditingFolderSelectAll(selectAll);
    setFolderActionMenuId(null);
    setFolderActionMenuAnchor(null);
    setFolderActionMenuPoint(null);
  }

  function cancelFolderEdit() {
    cancelFolderEditRef.current = true;
    setEditingFolderId(null);
    setEditingFolderTitle("");
    setEditingFolderSelectAll(false);
  }

  async function commitFolderEdit(folder: ActivityBankFolder) {
    if (cancelFolderEditRef.current) {
      cancelFolderEditRef.current = false;
      return;
    }
    if (!bank || editingFolderId !== folder.id) return;
    const title = editingFolderTitle.trim() || t("activityBankDetail.defaultFolderTitle");
    setEditingFolderId(null);
    setEditingFolderTitle("");
    setEditingFolderSelectAll(false);
    if (title === folder.title) return;
    setError("");
    try {
      await api.updateActivityBankFolder(bank.id, folder.id, { title });
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.updateFolderError"));
    }
  }

  function handleFolderTitleBlur(folder: ActivityBankFolder) {
    if (skipFolderBlurRef.current) {
      skipFolderBlurRef.current = false;
      return;
    }
    void commitFolderEdit(folder);
  }

  function handleFolderTitleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, folder: ActivityBankFolder) {
    if (event.key === "Enter") {
      event.preventDefault();
      skipFolderBlurRef.current = true;
      void commitFolderEdit(folder);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelFolderEdit();
    }
  }

  async function confirmDeleteFolder() {
    if (!bank || !deletingFolder) return;
    setSavingFolder(true);
    setError("");
    try {
      await api.deleteActivityBankFolder(bank.id, deletingFolder.id);
      setDeletingFolder(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.deleteFolderError"));
    } finally {
      setSavingFolder(false);
    }
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function openFolderContextMenu(folder: ActivityBankFolder, event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setFolderActionMenuAnchor(null);
    setFolderActionMenuPoint({ x: event.clientX, y: event.clientY });
    setFolderActionMenuId(folder.id);
  }

  async function updateBankTreeItem(item: BankTreeItem, input: { parentId?: string | null; position?: number }) {
    if (!bank) return;
    if (item.kind === "folder") {
      await api.updateActivityBankFolder(bank.id, item.id, input);
    } else {
      await api.updateBankActivityPlacement(bank.id, item.id, {
        ...(input.parentId !== undefined ? { folderId: input.parentId } : {}),
        ...(input.position !== undefined ? { position: input.position } : {})
      });
    }
  }

  async function moveItemBesideTarget(dragged: BankTreeItem, target: BankTreeItem, placement: "before" | "after") {
    const parentId = target.parentId;
    const siblings = bankTreeItems
      .filter((item) => item.id !== dragged.id && item.parentId === parentId)
      .sort(compareBankTreeItems);
    const targetIndex = siblings.findIndex((item) => item.id === target.id);
    if (targetIndex === -1) return;
    siblings.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, { ...dragged, parentId });
    await Promise.all(siblings.map((item, index) => updateBankTreeItem(item, { parentId, position: index })));
  }

  async function moveItemIntoFolder(item: BankTreeItem, folder: ActivityBankFolder) {
    await updateBankTreeItem(item, { parentId: folder.id, position: nextBankItemPosition(folder.id, item.id) });
  }

  async function moveItemToRoot(item: BankTreeItem) {
    await updateBankTreeItem(item, { parentId: null, position: nextBankItemPosition(null, item.id) });
  }

  async function moveItemSafely(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.moveWithinBankError"));
    }
  }

  function nextBankItemPosition(parentId: string | null, excludedId?: string) {
    return Math.max(
      -1,
      ...bankTreeItems.filter((item) => item.id !== excludedId && item.parentId === parentId).map((item) => item.position)
    ) + 1;
  }

  function handleItemPointerDown(item: BankTreeItem, event: PointerEvent) {
    if (event.button !== 0 || !bank?.canManage) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let dragStarted = false;

    const activateDrag = (x: number, y: number) => {
      if (dragStarted) return true;
      const deltaX = x - startX;
      const deltaY = y - startY;
      if (deltaX * deltaX + deltaY * deltaY < 36) return false;
      dragStarted = true;
      setDraggingItemId(item.id);
      setDragPreview({ title: item.title, x, y });
      return true;
    };

    const movePreview = (moveEvent: globalThis.PointerEvent) => {
      if (!activateDrag(moveEvent.clientX, moveEvent.clientY)) return;
      setDragPreview((current) => current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current);
      setDropTarget(findBankDropTarget(moveEvent.clientX, moveEvent.clientY, item.id));
    };

    const finishDrag = async (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("pointermove", movePreview);
      const targetDescriptor = findBankDropTarget(upEvent.clientX, upEvent.clientY, item.id);
      setDraggingItemId(null);
      setDragPreview(null);
      setDropTarget(null);
      if (!dragStarted) return;
      if (targetDescriptor?.type === "root") {
        if (item.parentId) await moveItemSafely(() => moveItemToRoot(item));
        return;
      }
      if (!targetDescriptor || targetDescriptor.type !== "item") return;
      const target = bankTreeItems.find((candidate) => candidate.id === targetDescriptor.id);
      if (!target) return;
      await moveItemSafely(async () => {
        if (targetDescriptor.placement === "inside" && target.kind === "folder") {
          if (item.kind === "folder" && isBankFolderDescendant(bankTreeItems, target.id, item.id)) {
            setError(t("activityBankDetail.invalidFolderMove"));
            return;
          }
          await moveItemIntoFolder(item, target.folder);
        } else {
          await moveItemBesideTarget(item, target, targetDescriptor.placement === "before" ? "before" : "after");
        }
      });
    };

    const cancelDrag = () => {
      setDraggingItemId(null);
      setDragPreview(null);
      setDropTarget(null);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointermove", movePreview);
    };

    window.addEventListener("pointermove", movePreview);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", cancelDrag, { once: true });
  }

  function findBankDropTarget(x: number, y: number, draggedId: string): BankDropTarget | null {
    const element = document.elementFromPoint(x, y);
    if (element?.closest("[data-bank-root-drop='true']")) return { id: "root", type: "root" };
    const itemElement = element?.closest("[data-bank-tree-item-id]");
    if (!(itemElement instanceof HTMLElement)) return null;
    const targetId = itemElement.dataset.bankTreeItemId;
    if (!targetId || targetId === draggedId) return null;
    const target = bankTreeItems.find((candidate) => candidate.id === targetId);
    const rect = itemElement.getBoundingClientRect();
    const relativeY = rect.height ? (y - rect.top) / rect.height : 0.5;
    const placement = target?.kind === "folder" && relativeY >= 0.25 && relativeY <= 0.75
      ? "inside"
      : relativeY < 0.5 ? "before" : "after";
    return { id: targetId, placement, type: "item" };
  }

  function openConceptFilter() {
    setDraftConceptIds(new Set(selectedConceptIds));
    setShowConceptFilter(true);
  }

  function toggleDraftConcept(conceptId: string) {
    setDraftConceptIds((current) => {
      const next = new Set(current);
      if (next.has(conceptId)) next.delete(conceptId);
      else next.add(conceptId);
      return next;
    });
  }

  function applyConceptFilter() {
    setSelectedConceptIds(new Set(draftConceptIds));
    setCollapsedFolderIds(new Set());
    setShowConceptFilter(false);
  }

  function activityTypeLabel(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    const localized = definition?.i18n?.[locale];
    return localized?.name ?? definition?.name ?? activityTypes.find((type) => type.key === activityTypeKey)?.name ?? activityTypeKey;
  }

  function activityTypeDescription(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    const localized = definition?.i18n?.[locale];
    return localized?.description ?? definition?.description ?? activityTypes.find((type) => type.key === activityTypeKey)?.description ?? "";
  }

  function activityTypeBelongsToCategory(activityTypeKey: string, categoryId: ActivityCategoryId) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    return activityDefinitionBelongsToCategory(definition, categoryId);
  }

  function activityTypeCreatesCategory(activityTypeKey: string, categoryId: ActivityCategoryId) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    return activityDefinitionCreatesCategory(definition, categoryId);
  }

  function activityTypeIconName(activityTypeKey: string) {
    return activityDefinitions.find((candidate) => candidate.key === activityTypeKey)?.icon ?? "placeholder";
  }

  const bankActivityTypes = activityTypes.filter((type) => {
    const definition = activityDefinitions.find((candidate) => candidate.key === type.key);
    return (definition?.provider?.kind !== "core" || definition.key === "test") && (!definition?.creationScopes || definition.creationScopes.includes("bank"));
  });
  const visibleActivityCategories = activityCategories.filter((category) =>
    bankActivityTypes.some((type) => activityTypeCreatesCategory(type.key, category.id))
  );
  const visibleActivityTypes = bankActivityTypes.filter((type) => activityTypeBelongsToCategory(type.key, selectedCategoryId));
  const bankTreeItems = createBankTreeItems(bank?.folders ?? [], bank?.activities ?? []);
  const matchingActivityIds = selectedConceptIds.size
    ? new Set((bank?.activities ?? []).filter((activity) =>
        activity.knowledgeConcepts?.some((selection) => selectedConceptIds.has(selection.conceptId))
      ).map((activity) => activity.id))
    : null;
  const visibleBankTreeItems = flattenBankTree(bankTreeItems, collapsedFolderIds, matchingActivityIds);
  const subjectConcepts = bank?.subject?.knowledgeConcepts ?? [];

  useEffect(() => {
    if (visibleActivityCategories.some((category) => category.id === selectedCategoryId)) {
      return;
    }
    setSelectedCategoryId(visibleActivityCategories[0]?.id ?? "generic");
  }, [selectedCategoryId, visibleActivityCategories]);

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact">
          <div className="hero-meta">
            <p className="eyebrow">{bank?.subject?.title ?? t("nav.activityBanks")}</p>
            <h1>{bank?.title ?? t("common.loading")}</h1>
            {bank?.description ? <p className="muted">{bank.description}</p> : null}
          </div>
          <Link className="button secondary" href="/activity-banks">
            {t("activityBankDetail.backToBanks")}
          </Link>
        </section>

        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("activityBankDetail.activitiesEyebrow")}</p>
              <h2>{t("activityBankDetail.activitiesTitle")}</h2>
            </div>
            <div className="section-actions activity-bank-tree-actions">
              <button className="secondary" type="button" onClick={openConceptFilter}>
                {selectedConceptIds.size
                  ? t("activityBankDetail.filtersActive", { count: selectedConceptIds.size })
                  : t("activityBankDetail.filters")}
              </button>
              {bank?.canManage ? (
                <>
                  <button className="secondary" disabled={savingFolder} type="button" onClick={() => void createInlineFolder(null)}>
                    <AppIcon name="folderAdd" />
                    {t("activityBankDetail.newFolder")}
                  </button>
                  <button type="button" onClick={() => openActivityPicker(null)}>
                    {t("activityBankDetail.addActivityTitle")}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {visibleBankTreeItems.length ? (
            <div className="table-list activity-bank-activities-table activity-bank-tree">
              {bank?.canManage ? (
                <div
                  className={`root-drop-zone ${draggingItemId ? "is-active" : ""} ${dropTarget?.type === "root" ? "is-drop-target" : ""}`}
                  data-bank-root-drop="true"
                >
                  {t("activityBankDetail.moveToTopLevel")}
                </div>
              ) : null}
              {visibleBankTreeItems.map(({ item, depth }) => {
                const isFolder = item.kind === "folder";
                const isCollapsed = isFolder && collapsedFolderIds.has(item.id);
                const activity = item.kind === "activity" ? item.activity : null;
                return (
                  <div
                    className={`table-row table-row-content-tree activity-bank-tree-row ${draggingItemId === item.id ? "is-dragging" : ""} ${
                      dropTarget?.type === "item" && dropTarget.id === item.id ? `is-drop-target is-drop-${dropTarget.placement}` : ""
                    } ${isFolder ? "is-folder-row" : ""}`}
                    data-bank-tree-item-id={item.id}
                    key={`${item.kind}-${item.id}`}
                    onContextMenu={
                      isFolder && bank?.canManage
                        ? (event) => openFolderContextMenu(item.folder, event)
                        : undefined
                    }
                    style={{ "--content-tree-indent": `${14 + depth * 20}px`, paddingLeft: 14 + depth * 20 } as CSSProperties}
                  >
                    <div className="table-main table-main-stack">
                      {bank?.canManage ? (
                        <span
                          aria-label={t("activityBankDetail.dragItem", { title: item.title })}
                          className="drag-handle"
                          role="button"
                          tabIndex={0}
                          title={t("activityBankDetail.dragToMove")}
                          onPointerDown={(event) => handleItemPointerDown(item, event)}
                        >
                          <AppIcon name="drag" />
                        </span>
                      ) : <span className="content-tree-student-spacer" aria-hidden="true" />}
                      {isFolder ? (
                        <button
                          aria-label={t(isCollapsed ? "activityBankDetail.expandFolder" : "activityBankDetail.collapseFolder", { title: item.title })}
                          className="content-item-icon-button"
                          type="button"
                          onClick={() => toggleFolder(item.id)}
                        >
                          <FolderContentIcon collapsed={Boolean(isCollapsed)} />
                        </button>
                      ) : (
                        <span className="content-item-icon">
                          <ActivityTypeIcon iconName={activityTypeIconName(activity?.activityType.key ?? "")} />
                        </span>
                      )}
                      {isFolder && editingFolderId === item.id ? (
                        <input
                          ref={folderTitleInputRef}
                          aria-label={t("activityBankDetail.renameFolder", { title: item.title })}
                          className="content-title-input"
                          data-folder-id={item.id}
                          value={editingFolderTitle}
                          onBlur={() => handleFolderTitleBlur(item.folder)}
                          onChange={(event) => setEditingFolderTitle(event.target.value)}
                          onKeyDown={(event) => handleFolderTitleKeyDown(event, item.folder)}
                        />
                      ) : (
                        <strong>
                          {activity && bank ? (
                            <Link href={`/activity-banks/${bank.id}/activities/${activity.id}`}>{item.title}</Link>
                          ) : item.title}
                        </strong>
                      )}
                      {activity ? (
                        <span className="metadata-badges">
                          <span className="metadata-badge is-activity-type">{activityTypeLabel(activity.activityType.key)}</span>
                          <span className="metadata-badge">{t(`activityLifecycle.${activity.lifecycle}`)}</span>
                          <span className="metadata-badge">{activity.currentVersion
                            ? activity.lifecycle === "draft"
                              ? t("activityBankDetail.unpublishedChanges", { version: activity.currentVersion.versionNumber })
                              : `v${activity.currentVersion.versionNumber}`
                            : t("activityBankDetail.notPublished")}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="table-actions content-row-actions">
                      {activity && bank ? (
                        <Link
                          aria-label={t("activityBankDetail.editActivityLink", { title: activity.title })}
                          className="button secondary icon-button"
                          href={`/activity-banks/${bank.id}/activities/${activity.id}`}
                          title={t("common.open")}
                        >
                          <AppIcon name="open" />
                        </Link>
                      ) : null}
                      {bank?.canManage ? (
                        <button
                          aria-expanded={isFolder ? folderActionMenuId === item.id : activityActionMenuId === item.id}
                          aria-haspopup="menu"
                          aria-label={isFolder
                            ? t("activityBankDetail.folderActions", { title: item.title })
                            : t("activityBankDetail.activityActions", { title: item.title })}
                          className="secondary icon-button"
                          type="button"
                          onClick={(event) => {
                            if (isFolder) {
                              const opening = folderActionMenuId !== item.id;
                              setFolderActionMenuId(opening ? item.id : null);
                              setFolderActionMenuAnchor(opening ? event.currentTarget : null);
                              setFolderActionMenuPoint(null);
                            } else {
                              const opening = activityActionMenuId !== item.id;
                              setActivityActionMenuId(opening ? item.id : null);
                              setActivityActionMenuAnchor(opening ? event.currentTarget : null);
                            }
                          }}
                        >
                          <AppIcon name="more" />
                        </button>
                      ) : null}
                    </div>
                    {isFolder ? (
                      <ContextMenu
                        anchor={folderActionMenuId === item.id ? folderActionMenuAnchor : null}
                        className="content-context-menu"
                        open={folderActionMenuId === item.id}
                        point={folderActionMenuId === item.id ? folderActionMenuPoint : null}
                        onClose={() => { setFolderActionMenuId(null); setFolderActionMenuAnchor(null); setFolderActionMenuPoint(null); }}
                      >
                        <button className="content-context-menu-item" type="button" role="menuitem" onClick={() => openActivityPicker(item.id)}>
                          <AppIcon name="activityAdd" />
                          <span>{t("activityBankDetail.newActivityInFolder")}</span>
                        </button>
                        <button className="content-context-menu-item" disabled={savingFolder} type="button" role="menuitem" onClick={() => { setFolderActionMenuId(null); void createInlineFolder(item.id); }}>
                          <AppIcon name="folderAdd" />
                          <span>{t("activityBankDetail.newFolderInFolder")}</span>
                        </button>
                        <button className="content-context-menu-item" type="button" role="menuitem" onClick={() => startEditingFolder(item.folder, false)}>
                          <EditIcon />
                          <span>{t("activityBankDetail.renameFolderAction")}</span>
                        </button>
                        <button className="content-context-menu-item is-danger" type="button" role="menuitem" onClick={() => { setFolderActionMenuId(null); setDeletingFolder(item.folder); }}>
                          <RemoveIcon />
                          <span>{t("common.remove")}</span>
                        </button>
                      </ContextMenu>
                    ) : activity ? (
                      <ContextMenu anchor={activityActionMenuId === activity.id ? activityActionMenuAnchor : null} className="content-context-menu" open={activityActionMenuId === activity.id} onClose={() => { setActivityActionMenuId(null); setActivityActionMenuAnchor(null); }}>
                        <Link className="content-context-menu-item" href={`/activity-banks/${bank?.id}/activities/${activity.id}`} role="menuitem"><EditIcon /><span>{t("common.edit")}</span></Link>
                        {activity.lifecycle !== "published" ? <button className="content-context-menu-item" disabled={publishingActivityId !== null} onClick={() => void publishActivity(activity)} role="menuitem" type="button"><AppIcon name="check" /><span>{t("activityBankDetail.publishActivity")}</span></button> : null}
                        <button className="content-context-menu-item" disabled={duplicatingActivityId === activity.id} onClick={() => { setActivityActionMenuId(null); setDuplicatingActivity(activity); setDuplicateTitle(defaultDuplicateBankActivityTitle(activity.title)); }} role="menuitem" type="button"><DuplicateIcon /><span>{t("activityBankDetail.duplicateActivity")}</span></button>
                        <button className="content-context-menu-item" onClick={() => { setActivityActionMenuId(null); setMovingActivity(activity); setMoveTargetBankId(""); }} role="menuitem" type="button"><MoveIcon /><span>{t("activityBankDetail.moveActivity")}</span></button>
                        {(activity.versions?.length ?? 0) >= 2 ? <button className="content-context-menu-item" onClick={() => openVersionComparison(activity)} role="menuitem" type="button"><CompareIcon /><span>{t("bankActivityPage.compareVersions")}</span></button> : null}
                        <button className="content-context-menu-item is-danger" disabled={deletingActivityId === activity.id} onClick={() => { setActivityActionMenuId(null); setDeleteActivityState({ activity, courseCount: null }); }} role="menuitem" type="button"><RemoveIcon /><span>{t("common.remove")}</span></button>
                      </ContextMenu>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : <p className="muted">{selectedConceptIds.size ? t("activityBankDetail.noFilterMatches") : t("activityBankDetail.noActivities")}</p>}
        </section>

        <ConfirmationDialog
          open={Boolean(deleteActivityState)}
          eyebrow={t("activityBankDetail.deleteActivityEyebrow")}
          title={t("activityBankDetail.deleteActivityDialogTitle")}
          message={deleteActivityState?.courseCount === null
            ? t("activityBankDetail.deleteActivityConfirm", { title: deleteActivityState?.activity.title ?? "" })
            : t("activityBankDetail.deleteActivityInUseConfirm", {
                title: deleteActivityState?.activity.title ?? "",
                count: deleteActivityState?.courseCount ?? 0
              })}
          confirmLabel={deleteActivityState?.courseCount === null ? t("common.remove") : t("activityBankDetail.removeAndPreserveCopies")}
          cancelLabel={t("common.cancel")}
          confirmVariant="danger"
          isConfirming={Boolean(deletingActivityId)}
          onCancel={() => setDeleteActivityState(null)}
          onConfirm={confirmDeleteActivity}
        />

        <ConfirmationDialog
          open={Boolean(deletingFolder)}
          eyebrow={t("activityBankDetail.folderEyebrow")}
          title={t("activityBankDetail.deleteFolderTitle")}
          message={t("activityBankDetail.deleteFolderConfirm", { title: deletingFolder?.title ?? "" })}
          confirmLabel={t("common.remove")}
          cancelLabel={t("common.cancel")}
          confirmVariant="danger"
          isConfirming={savingFolder}
          onCancel={() => setDeletingFolder(null)}
          onConfirm={confirmDeleteFolder}
        />

        {showConceptFilter ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-modal="true" className="dialog-panel activity-bank-filter-dialog" role="dialog" aria-labelledby="activity-bank-filter-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("activityBankDetail.filters")}</p>
                  <h2 id="activity-bank-filter-title">{t("activityBankDetail.filterByConcepts")}</h2>
                  <p className="muted">{t("activityBankDetail.filterByConceptsHelp")}</p>
                </div>
                <button className="secondary icon-button" type="button" onClick={() => setShowConceptFilter(false)} title={t("common.close")}>
                  <CloseIcon />
                </button>
              </div>
              {subjectConcepts.length ? (
                <div className="activity-bank-concept-filter-list">
                  {subjectConcepts.map((concept) => (
                    <label className="activity-bank-concept-filter-row" htmlFor={`bank-concept-filter-${concept.id}`} key={concept.id}>
                      <input
                        checked={draftConceptIds.has(concept.id)}
                        id={`bank-concept-filter-${concept.id}`}
                        type="checkbox"
                        onChange={() => toggleDraftConcept(concept.id)}
                      />
                      <span>{concept.title}</span>
                      <span className="metadata-badge">{bank?.conceptActivityCounts?.[concept.id] ?? 0}</span>
                    </label>
                  ))}
                </div>
              ) : <p className="muted">{t("activityBankDetail.noSubjectConcepts")}</p>}
              <div className="dialog-actions">
                <button className="secondary" type="button" onClick={() => setDraftConceptIds(new Set())}>{t("activityBankDetail.clearFilters")}</button>
                <button className="secondary" type="button" onClick={() => setShowConceptFilter(false)}>{t("common.cancel")}</button>
                <button type="button" onClick={applyConceptFilter}>{t("activityBankDetail.applyFilters")}</button>
              </div>
            </section>
          </div>
        ) : null}

        {dragPreview ? (
          <div className="drag-preview" style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }}>
            {dragPreview.title}
          </div>
        ) : null}

        {duplicatingActivity ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="duplicate-bank-activity-title">
              <div className="section-heading">
                <div><p className="eyebrow">{t("activityBankDetail.duplicateActivityEyebrow")}</p><h2 id="duplicate-bank-activity-title">{t("activityBankDetail.duplicateActivityTitle")}</h2></div>
                <button className="secondary icon-button" type="button" onClick={() => setDuplicatingActivity(null)} title={t("common.close")}><CloseIcon /></button>
              </div>
              <form className="form" onSubmit={duplicateActivity}>
                <div className="field"><label htmlFor="duplicate-bank-activity-name">{t("activityBankDetail.duplicateActivityTitleLabel")}</label><input id="duplicate-bank-activity-name" minLength={2} maxLength={160} required autoFocus value={duplicateTitle} onChange={(event) => setDuplicateTitle(event.target.value)} /></div>
                <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setDuplicatingActivity(null)}>{t("common.cancel")}</button><button disabled={Boolean(duplicatingActivityId) || duplicateTitle.trim().length < 2} type="submit">{duplicatingActivityId ? t("common.saving") : t("activityBankDetail.duplicateActivity")}</button></div>
              </form>
            </section>
          </div>
        ) : null}

        {movingActivity && bank ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="move-bank-activity-title">
              <div className="section-heading">
                <div><p className="eyebrow">{t("activityBankDetail.moveActivityEyebrow")}</p><h2 id="move-bank-activity-title">{t("activityBankDetail.moveActivityTitle")}</h2></div>
                <button className="secondary icon-button" type="button" onClick={() => setMovingActivity(null)} title={t("common.close")}><CloseIcon /></button>
              </div>
              <p>{t("activityBankDetail.moveActivityMessage", { title: movingActivity.title })}</p>
              <form className="form" onSubmit={moveActivity}>
                <div className="field">
                  <label htmlFor="move-bank-activity-target">{t("activityBankDetail.moveActivityDestination")}</label>
                  <select id="move-bank-activity-target" required value={moveTargetBankId} onChange={(event) => setMoveTargetBankId(event.target.value)}>
                    <option value="">{t("activityBankDetail.chooseMoveDestination")}</option>
                    {activityBanks.filter((candidate) => candidate.id !== bank.id && candidate.subjectId === bank.subjectId && candidate.canManage).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
                  </select>
                  {!activityBanks.some((candidate) => candidate.id !== bank.id && candidate.subjectId === bank.subjectId && candidate.canManage) ? <p className="muted">{t("activityBankDetail.noMoveDestinations")}</p> : null}
                </div>
                <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setMovingActivity(null)}>{t("common.cancel")}</button><button disabled={savingEdit || !moveTargetBankId} type="submit">{savingEdit ? t("common.saving") : t("activityBankDetail.moveActivity")}</button></div>
              </form>
            </section>
          </div>
        ) : null}

        {comparingActivity ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-modal="true" className="dialog-panel activity-version-diff-dialog" role="dialog" aria-labelledby="version-comparison-title">
              <div className="section-heading">
                <div><p className="eyebrow">{t("bankActivityPage.versionHistory")}</p><h2 id="version-comparison-title">{comparingActivity.title}</h2></div>
                <button className="secondary icon-button" type="button" onClick={() => setComparingActivity(null)} title={t("common.close")}><CloseIcon /></button>
              </div>
              <div className="grid compact-form-grid version-comparison-controls">
                <div className="field"><label htmlFor="version-diff-from">{t("bankActivityPage.versionDiffFrom")}</label><select id="version-diff-from" value={fromVersionId} onChange={(event) => { setFromVersionId(event.target.value); setVersionDiff(null); }}>
                  {comparingActivity.versions?.map((version) => <option key={version.id} value={version.id}>{versionOptionLabel(version.versionNumber, version.createdAt, locale)}</option>)}
                </select></div>
                <div className="field"><label htmlFor="version-diff-to">{t("bankActivityPage.versionDiffTo")}</label><select id="version-diff-to" value={toVersionId} onChange={(event) => { setToVersionId(event.target.value); setVersionDiff(null); }}>
                  {comparingActivity.versions?.map((version) => <option key={version.id} value={version.id}>{versionOptionLabel(version.versionNumber, version.createdAt, locale)}</option>)}
                </select></div>
              </div>
              {fromVersionId === toVersionId ? <p className="error">{t("bankActivityPage.versionDiffChooseDifferent")}</p> : null}
              <div><button disabled={versionDiffLoading || !fromVersionId || !toVersionId || fromVersionId === toVersionId} type="button" onClick={() => void compareVersions()}>{versionDiffLoading ? t("common.loading") : t("bankActivityPage.compareVersions")}</button></div>
              {versionDiffError ? <p className="error">{versionDiffError}</p> : null}
              {versionDiff ? <ActivityVersionDiffView diff={versionDiff} labels={versionDiffLabels(t)} /> : null}
            </section>
          </div>
        ) : null}

        {showActivityPicker ? (
          <div className="dialog-backdrop" role="presentation">
            <section aria-modal="true" className="dialog-panel activity-picker-dialog" role="dialog" aria-labelledby="activity-picker-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("activityBankDetail.chooseActivityEyebrow")}</p>
                  <h2 id="activity-picker-title">{t("activityBankDetail.chooseActivityTitle")}</h2>
                </div>
                <button className="secondary icon-button" type="button" onClick={() => setShowActivityPicker(false)} title={t("common.cancel")}>
                  <CloseIcon />
                </button>
              </div>
              <div className="activity-picker-layout">
                <div className="activity-category-tabs" role="tablist" aria-label={t("activityBankDetail.categoryTabsLabel")}>
                  {visibleActivityCategories.map((category) => (
                    <button
                      key={category.id}
                      className={selectedCategoryId === category.id ? "activity-category-tab is-active" : "activity-category-tab"}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategoryId === category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      {t(category.labelKey)}
                    </button>
                  ))}
                </div>
                <div className="activity-type-options" role="tabpanel">
                  {visibleActivityTypes.map((type) => (
                    <button
                      key={type.id}
                      className="activity-type-option"
                      type="button"
                      disabled={savingActivity || !bank}
                      onClick={() => createBankActivity(type.key)}
                    >
                      <ActivityTypeIcon iconName={activityTypeIconName(type.key)} />
                      <span>
                        <strong>{activityTypeLabel(type.key)}</strong>
                        <small>{activityTypeDescription(type.key)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {editingActivity ? (
          <section className="section stack">
            <h2>{t("activityBankDetail.editActivityTitle")}</h2>
            <form className="form" onSubmit={saveActivityEdit}>
              <div className="field">
                <label htmlFor="edit-activity-title">{t("activityBankDetail.titleHeader")}</label>
                <input
                  id="edit-activity-title"
                  value={editingActivity.title}
                  minLength={2}
                  required
                  onChange={(event) => setEditingActivity({ ...editingActivity, title: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-activity-description">{t("activityBankDetail.descriptionLabel")}</label>
                <textarea
                  id="edit-activity-description"
                  value={editingActivity.description}
                  onChange={(event) => setEditingActivity({ ...editingActivity, description: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-activity-type">{t("activityBankDetail.activityTypeLabel")}</label>
                <select
                  id="edit-activity-type"
                  value={editingActivity.activityTypeKey}
                  onChange={(event) => setEditingActivity({ ...editingActivity, activityTypeKey: event.target.value })}
                >
                  {bankActivityTypes.map((type) => (
                    <option key={type.id} value={type.key}>
                      {activityTypeLabel(type.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-activity-lifecycle">{t("activityBankDetail.statusHeader")}</label>
                <select
                  id="edit-activity-lifecycle"
                  value={editingActivity.lifecycle}
                  onChange={(event) =>
                    setEditingActivity({
                      ...editingActivity,
                      lifecycle: event.target.value as EditingActivityState["lifecycle"]
                    })
                  }
                >
                  <option value="draft">{t("activityLifecycle.draft")}</option>
                  <option value="published">{t("activityLifecycle.published")}</option>
                  <option value="paused">{t("activityLifecycle.paused")}</option>
                  <option value="archived">{t("activityLifecycle.archived")}</option>
                </select>
              </div>
              <div className="row">
                <button type="submit" disabled={savingEdit}>
                  {savingEdit ? t("common.saving") : t("common.save")}
                </button>
                <button className="secondary" type="button" onClick={() => setEditingActivity(null)}>
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function createBankTreeItems(folders: ActivityBankFolder[], activities: BankActivity[]): BankTreeItem[] {
  return [
    ...folders.map((folder): BankTreeItem => ({
      id: folder.id,
      kind: "folder",
      parentId: folder.parentId,
      position: folder.position,
      title: folder.title,
      folder
    })),
    ...activities.map((activity): BankTreeItem => ({
      id: activity.id,
      kind: "activity",
      parentId: activity.folderId ?? null,
      position: activity.position,
      title: activity.title,
      activity
    }))
  ];
}

function compareBankTreeItems(left: BankTreeItem, right: BankTreeItem) {
  return left.position - right.position || left.title.localeCompare(right.title);
}

function flattenBankTree(items: BankTreeItem[], collapsedFolderIds: Set<string>, matchingActivityIds: Set<string> | null) {
  const folderIds = new Set(items.filter((item) => item.kind === "folder").map((item) => item.id));
  const includedFolderIds = new Set<string>();
  if (matchingActivityIds) {
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const activity of items.filter((item) => item.kind === "activity" && matchingActivityIds.has(item.id))) {
      let parentId = activity.parentId;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        includedFolderIds.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
  }

  const visibleItems = matchingActivityIds
    ? items.filter((item) => item.kind === "activity" ? matchingActivityIds.has(item.id) : includedFolderIds.has(item.id))
    : items;
  const visibleIds = new Set(visibleItems.map((item) => item.id));
  const byParent = new Map<string, BankTreeItem[]>();
  for (const item of visibleItems) {
    const parentId = item.parentId && visibleIds.has(item.parentId) ? item.parentId : "root";
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), item]);
  }
  for (const [parentId, children] of byParent) byParent.set(parentId, children.sort(compareBankTreeItems));

  const rows: Array<{ item: BankTreeItem; depth: number }> = [];
  const visited = new Set<string>();
  function walk(parentId: string, depth: number) {
    for (const item of byParent.get(parentId) ?? []) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      rows.push({ item, depth });
      if (item.kind === "folder" && !collapsedFolderIds.has(item.id)) walk(item.id, depth + 1);
    }
  }
  walk("root", 0);

  for (const item of visibleItems.sort(compareBankTreeItems)) {
    if (!visited.has(item.id) && (!item.parentId || !folderIds.has(item.parentId))) rows.push({ item, depth: 0 });
  }
  return rows;
}

function isBankFolderDescendant(items: BankTreeItem[], possibleChildId: string, possibleAncestorId: string) {
  const byId = new Map(items.map((item) => [item.id, item]));
  let current = byId.get(possibleChildId);
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parentId === possibleAncestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

function getCourseCountFromDeleteError(details: unknown) {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const courseCount = (details as Record<string, unknown>).courseCount;
    if (typeof courseCount === "number" && Number.isFinite(courseCount)) {
      return courseCount;
    }
  }
  return 0;
}

function versionOptionLabel(versionNumber: number, createdAt: string, locale: string) {
  return `v${versionNumber} · ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(createdAt))}`;
}

function versionDiffLabels(t: I18nTranslate) {
  return {
    before: t("bankActivityPage.versionDiffBefore"), after: t("bankActivityPage.versionDiffAfter"),
    summary: t("bankActivityPage.versionDiffSummary"), noChanges: t("bankActivityPage.versionDiffNoChanges"),
    "section.core": t("bankActivityPage.versionDiffSectionActivity"), "section.config": t("bankActivityPage.versionDiffSectionConfig"), "section.metadata": t("bankActivityPage.versionDiffSectionMetadata"),
    "field.config": t("bankActivityPage.versionDiffSectionConfig"), "field.metadata": t("bankActivityPage.versionDiffSectionMetadata"),
    "field.title": t("bankActivityPage.versionDiffFieldTitle"), "field.description": t("bankActivityPage.versionDiffFieldDescription"), "field.lifecycle": t("bankActivityPage.versionDiffFieldLifecycle"), "field.activityType": t("bankActivityPage.versionDiffFieldType"), "field.knowledgeConcepts": t("bankActivityPage.versionDiffFieldConcepts"),
    "change.added": t("bankActivityPage.versionDiffAdded"), "change.removed": t("bankActivityPage.versionDiffRemoved"), "change.changed": t("bankActivityPage.versionDiffChanged")
  };
}

function EditIcon() {
  return <AppIcon name="edit" />;
}

function RemoveIcon() {
  return <AppIcon name="remove" />;
}

function DuplicateIcon() {
  return <AppIcon name="duplicate" />;
}

function MoveIcon() {
  return <AppIcon name="move" />;
}

function CompareIcon() {
  return <AppIcon name="compare" />;
}

function CloseIcon() {
  return <AppIcon name="close" />;
}
