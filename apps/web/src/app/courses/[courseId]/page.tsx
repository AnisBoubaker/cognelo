"use client";

import { MarkdownRenderer } from "@cognelo/activity-ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, PointerEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { api, ActivityBank, ActivityDefinition, ActivityType, Course, CourseMaterial } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
  const [activityTitle, setActivityTitle] = useState("");
  const [activityTypeKey, setActivityTypeKey] = useState("placeholder");
  const [bankActivityId, setBankActivityId] = useState("");
  const [isAddingActivity, setIsAddingActivity] = useState(false);
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
    if (courseResult.course.subjectId) {
      const banksResult = await api.activityBanks(courseResult.course.subjectId);
      setActivityBanks(banksResult.activityBanks);
      const firstBankActivity = banksResult.activityBanks.flatMap((bank) => bank.activities ?? [])[0];
      setBankActivityId((current) => current || firstBankActivity?.id || "");
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : t("courseDetail.loadError")));
  }, [courseId, t]);

  const membershipRole = course?.memberships?.find((membership) => membership.userId === user?.id)?.role;
  const canManage = user?.roles.includes("admin") || membershipRole === "owner" || membershipRole === "teacher";

  useEffect(() => {
    if (course && !canManage && course.groups?.[0]?.id) {
      router.replace(`/courses/${courseId}/groups/${course.groups[0].id}`);
    }
  }, [canManage, course, courseId, router]);

  async function createActivity(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const selectedBankActivity = activityBanks.flatMap((bank) => bank.activities ?? []).find((activity) => activity.id === bankActivityId);
      const selectedActivityCopy = activityCopy(selectedBankActivity?.activityType.key ?? activityTypeKey);
      await api.createActivity(courseId, {
        title: activityTitle || selectedBankActivity?.title || selectedActivityCopy.defaultTitle || t("courseDetail.defaultActivityTitle"),
        activityTypeKey: selectedBankActivity?.activityType.key ?? activityTypeKey,
        bankActivityId: selectedBankActivity?.id,
        activityVersionId: selectedBankActivity?.currentVersionId ?? undefined,
        lifecycle: "draft",
        description: selectedBankActivity?.description ?? "",
        config: {},
        metadata: { researchTags: [] },
        position: course?.activities?.length ?? 0
      });
      await refresh();
      setActivityTitle("");
      setBankActivityId("");
      setIsAddingActivity(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.createActivityError"));
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
                        <button className="secondary" type="button" onClick={() => setIsAddingActivity((current) => !current)}>
                          {isAddingActivity ? t("common.cancel") : t("courseDetail.activityShellTitle")}
                        </button>
                      </div>

                      {isAddingActivity ? (
                        <form className="form inline-panel" onSubmit={createActivity}>
                          <div>
                            <p className="eyebrow">{t("courseDetail.activityShellEyebrow")}</p>
                            <h2>{t("courseDetail.activityShellTitle")}</h2>
                          </div>
                          <div className="grid compact-form-grid">
                            <div className="field">
                              <label htmlFor="activityTitle">{t("courseDetail.activityTitle")}</label>
                              <input
                                id="activityTitle"
                                value={activityTitle}
                                onChange={(event) => setActivityTitle(event.target.value)}
                                placeholder={t("courseDetail.defaultActivityTitle")}
                                required
                                minLength={2}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor="bankActivity">Activity bank item</label>
                              <select id="bankActivity" value={bankActivityId} onChange={(event) => setBankActivityId(event.target.value)}>
                                <option value="">Create local course activity</option>
                                {activityBanks.map((bank) =>
                                  (bank.activities ?? []).map((activity) => (
                                    <option key={activity.id} value={activity.id}>
                                      {bank.title}: {activity.title} v{activity.currentVersion?.versionNumber ?? 1}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                            <div className="field">
                              <label htmlFor="activityType">{t("courseDetail.activityType")}</label>
                              <select
                                id="activityType"
                                value={activityTypeKey}
                                onChange={(event) => setActivityTypeKey(event.target.value)}
                                disabled={Boolean(bankActivityId)}
                              >
                                {activityTypes.map((type) => (
                                  <option key={type.id} value={type.key}>
                                    {activityCopy(type.key).name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="row">
                            <button type="submit">{t("courseDetail.attachActivity")}</button>
                            <button className="secondary" type="button" onClick={() => setIsAddingActivity(false)}>
                              {t("common.close")}
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {course.activities?.length ? (
                        <div className="table-list">
                          <div className="table-row table-row-groups table-head" aria-hidden="true">
                            <span>{t("courseDetail.titleHeader")}</span>
                            <span>{t("courseDetail.activityType")}</span>
                            <span>{t("courseDetail.statusHeader")}</span>
                            <span>{t("courseDetail.actionsHeader")}</span>
                          </div>
                          {course.activities.map((activity) => (
                            <div className="table-row" key={activity.id}>
                              <div className="table-main table-main-stack">
                                <strong>
                                  <Link href={`/courses/${course.id}/activities/${activity.id}`}>{activity.title}</Link>
                                </strong>
                                <span className="table-meta-note muted">
                                  {activity.activityVersion
                                    ? `Bank version ${activity.activityVersion.versionNumber}`
                                    : activityCopy(activity.activityType.key).description || t(`activityLifecycle.${activity.lifecycle}`)}
                                </span>
                              </div>
                              <span className="eyebrow">{activityCopy(activity.activityType.key).name}</span>
                              <span className="table-meta muted">{t(`activityLifecycle.${activity.lifecycle}`)}</span>
                              <div className="table-actions">
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
          <p>Loading course...</p>
        )}
      </main>
    </AppShell>
  );
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

function MaterialActionIcon({ name }: { name: "download" | "drag" | "edit" | "open" | "remove" }) {
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
