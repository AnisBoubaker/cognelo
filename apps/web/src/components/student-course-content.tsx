"use client";

import type { ContentTypeDefinition } from "@cognelo/content-type-sdk";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { ActivityTypeIcon, AppIcon, FolderContentIcon } from "@/components/app-icon";
import { SettingsSectionNav } from "@/components/settings-nav";
import {
  api,
  type ActivityDefinition,
  type ActivityType,
  type CourseContentItem,
  type CourseContentResource,
  type CourseGroup,
  type CourseGroupMaterial,
  type CourseMaterial,
  type StudentReleasedGrades
} from "@/lib/api";
import { ContentTypeIcon as MaterialTypeIcon } from "@/lib/content-type-renderers";
import { normalizeStudentFolderTabDepth, resolveStudentContentLayout } from "@/lib/course-settings";
import type { Locale } from "@/lib/i18n";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type CourseActivity = {
  id: string;
  title: string;
  activityType: ActivityType;
};

export function StudentCourseContent({
  courseId,
  groupId,
  courseMetadata,
  courseMaterials,
  groupMaterials,
  assignments,
  courseActivities = [],
  contentItems,
  contentReady = true,
  contentResources,
  contentTypeDefinitions,
  activityDefinitions,
  activityTypes,
  locale,
  t,
  selectedFolderId,
  folderHref,
  activityHref,
  submittedActivityIds = new Set<string>(),
  studentGrades = null,
  storageScope = "learner"
}: {
  courseId: string;
  groupId: string;
  courseMetadata?: Record<string, unknown>;
  courseMaterials: CourseMaterial[];
  groupMaterials: CourseGroupMaterial[];
  assignments: NonNullable<CourseGroup["activities"]>;
  courseActivities?: CourseActivity[];
  contentItems: CourseContentItem[];
  contentReady?: boolean;
  contentResources: CourseContentResource[];
  contentTypeDefinitions: ContentTypeDefinition[];
  activityDefinitions: ActivityDefinition[];
  activityTypes: ActivityType[];
  locale: Locale;
  t: Translate;
  selectedFolderId?: string | null;
  folderHref: (folderId: string) => string;
  activityHref: (activityId: string) => string;
  submittedActivityIds?: ReadonlySet<string>;
  studentGrades?: StudentReleasedGrades | null;
  storageScope?: "learner" | "preview";
}) {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [openRootFolderIds, setOpenRootFolderIds] = useState<Set<string>>(new Set());
  const [accordionStateLoaded, setAccordionStateLoaded] = useState(false);
  const now = Date.now();
  const studentContentItems = useMemo(
    () => contentItems.filter((item) => item.kind !== "activity" || Boolean(item.courseGroupActivityId)),
    [contentItems]
  );
  const rootContentItems = useMemo(
    () => studentContentItems.filter((item) => !item.parentId).sort(compareContentItems),
    [studentContentItems]
  );
  const rootFolders = rootContentItems.filter((item) => item.kind === "folder");
  const rootLooseItems = rootContentItems.filter((item) => item.kind !== "folder");
  const rootFolderIds = rootFolders.map((item) => item.id);
  const rootFolderIdSignature = rootFolderIds.join("|");
  const selectedRootFolder = rootFolders.find((item) => item.id === selectedFolderId) ?? rootFolders[0] ?? null;
  const layout = resolveStudentContentLayout(courseMetadata);
  const storageKey = `cognelo:course:${courseId}:group:${groupId}:student-content-accordion${storageScope === "preview" ? ":preview" : ""}`;
  const courseMaterialById = new Map(courseMaterials.map((material) => [material.id, material]));
  const groupMaterialById = new Map(groupMaterials.map((material) => [material.id, material]));
  const contentResourceById = new Map(contentResources.map((resource) => [resource.id, resource]));
  const contentTypeByKey = new Map(contentTypeDefinitions.map((definition) => [definition.key, definition]));
  const courseActivityById = new Map(courseActivities.map((activity) => [activity.id, activity]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const releasedGradeByActivityId = new Map(
    (studentGrades?.rows ?? []).filter((row) => row.score !== null).map((row) => [row.activityId, row])
  );

  useEffect(() => {
    setAccordionStateLoaded(false);
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      const parsedValue = storedValue ? JSON.parse(storedValue) : [];
      setOpenRootFolderIds(new Set(Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === "string") : []));
    } catch {
      setOpenRootFolderIds(new Set());
    } finally {
      setAccordionStateLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!accordionStateLoaded || !contentReady) return;
    const validFolderIds = new Set(rootFolderIdSignature ? rootFolderIdSignature.split("|") : []);
    setOpenRootFolderIds((current) => {
      const next = new Set([...current].filter((folderId) => validFolderIds.has(folderId)));
      return setsAreEqual(current, next) ? current : next;
    });
  }, [accordionStateLoaded, contentReady, rootFolderIdSignature]);

  useEffect(() => {
    if (!accordionStateLoaded || !contentReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...openRootFolderIds]));
    } catch {
      // The content remains usable when browser storage is unavailable.
    }
  }, [accordionStateLoaded, contentReady, openRootFolderIds, storageKey]);

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) => toggleSetValue(current, folderId));
  }

  function titleFor(item: CourseContentItem) {
    if (item.contentResourceId) return contentResourceById.get(item.contentResourceId)?.title ?? item.titleSnapshot ?? t("courseDetail.untitledMaterial");
    if (item.materialId) {
      return courseMaterialById.get(item.materialId)?.title
        ?? groupMaterialById.get(item.materialId)?.title
        ?? item.titleSnapshot
        ?? t("courseDetail.untitledMaterial");
    }
    if (item.courseGroupActivityId) return assignmentById.get(item.courseGroupActivityId)?.activity.title ?? item.titleSnapshot ?? t("courseDetail.defaultActivityTitle");
    if (item.activityId) return courseActivityById.get(item.activityId)?.title ?? item.titleSnapshot ?? t("courseDetail.defaultActivityTitle");
    return item.titleSnapshot ?? t("courseDetail.untitledFolder");
  }

  function hrefFor(item: CourseContentItem) {
    if (item.courseGroupActivityId) {
      const assignment = assignmentById.get(item.courseGroupActivityId);
      return assignment ? activityHref(assignment.activity.id) : null;
    }
    if (item.materialId && courseMaterialById.has(item.materialId)) {
      const material = courseMaterialById.get(item.materialId) as CourseMaterial;
      return legacyMaterialHref(api.groupCourseMaterialDownloadUrl(courseId, groupId, material.id), material);
    }
    if (item.materialId && groupMaterialById.has(item.materialId)) {
      const material = groupMaterialById.get(item.materialId) as CourseGroupMaterial;
      return legacyMaterialHref(api.groupMaterialDownloadUrl(courseId, groupId, material.id), material);
    }
    if (item.contentResourceId) {
      const resource = contentResourceById.get(item.contentResourceId);
      const definition = resource ? contentTypeByKey.get(resource.contentTypeKey) : null;
      if (!resource || !definition) return null;
      if (definition.embeddingSource === "file_upload" && typeof resource.metadata?.storedName === "string") {
        return withDownloadVersion(api.groupContentResourceDownloadUrl(courseId, groupId, resource.id), resource);
      }
      return typeof resource.metadata?.url === "string" ? resource.metadata.url : null;
    }
    return null;
  }

  function activityName(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    return definition?.i18n?.[locale]?.name
      ?? definition?.name
      ?? activityTypes.find((type) => type.key === activityTypeKey)?.name
      ?? activityTypeKey;
  }

  function renderRow(item: CourseContentItem, depth: number, options: { isRootAccordionFolder?: boolean } = {}) {
    const title = titleFor(item);
    const href = hrefFor(item);
    const isRootAccordionFolder = Boolean(options.isRootAccordionFolder);
    const isCollapsed = isRootAccordionFolder ? !openRootFolderIds.has(item.id) : collapsedFolderIds.has(item.id);
    const material = item.materialId ? courseMaterialById.get(item.materialId) ?? groupMaterialById.get(item.materialId) : null;
    const materialIsDownloadable = material ? legacyMaterialHasStoredFile(material) : false;
    const contentResource = item.contentResourceId ? contentResourceById.get(item.contentResourceId) : null;
    const contentResourceIsFile = contentResource
      ? contentTypeByKey.get(contentResource.contentTypeKey)?.embeddingSource === "file_upload"
      : false;
    const assignment = item.courseGroupActivityId ? assignmentById.get(item.courseGroupActivityId) : null;
    const courseActivity = item.activityId ? courseActivityById.get(item.activityId) : null;
    const activityTypeKey = assignment?.activity.activityType.key ?? courseActivity?.activityType.key ?? null;
    const activityLabel = activityTypeKey ? activityName(activityTypeKey) : null;
    const releasedGrade = assignment ? releasedGradeByActivityId.get(assignment.activity.id) : null;
    const isSubmitted = assignment ? submittedActivityIds.has(assignment.activity.id) : false;
    const availability = assignment ? getAvailabilityStatus(assignment.availableFrom, assignment.availableUntil, now) : "available";
    const isOpenable = availability !== "upcoming";
    const hasBadges = Boolean(activityLabel || assignment || availability !== "available" || isSubmitted || releasedGrade);
    const studentRowIndent = Math.max(0, depth - 1) * 28;

    return (
      <div
        className={`table-row table-row-content-tree is-student-content ${item.kind === "folder" ? "is-folder-row" : ""} ${isRootAccordionFolder ? `is-student-accordion-root ${isCollapsed ? "" : "is-open"}` : ""} ${isOpenable ? "" : "is-content-locked"}`}
        key={item.id}
        style={isRootAccordionFolder ? undefined : ({
          "--content-tree-indent": `${14 + Math.min(depth, 1) * 20}px`,
          "--student-content-row-indent": `${studentRowIndent}px`,
          paddingLeft: 14 + Math.min(depth, 1) * 20
        } as CSSProperties)}
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
              onClick={() => toggleFolder(item.id)}
            >
              <FolderContentIcon collapsed={isCollapsed} />
            </button>
          ) : item.kind !== "folder" ? (
            <span className="content-item-icon">
              {item.kind === "activity" ? (
                <ActivityTypeIcon iconName={activityDefinitions.find((definition) => definition.key === activityTypeKey)?.icon ?? "placeholder"} />
              ) : (
                <MaterialTypeIcon
                  iconName={(contentResource ? contentTypeByKey.get(contentResource.contentTypeKey)?.icon : null) ?? "file"}
                  mimeType={typeof contentResource?.metadata?.mimeType === "string" ? contentResource.metadata.mimeType : null}
                />
              )}
            </span>
          ) : null}
          <strong>
            {isRootAccordionFolder ? (
              <button
                aria-expanded={!isCollapsed}
                className="student-accordion-title-button"
                type="button"
                onClick={() => setOpenRootFolderIds((current) => toggleSetValue(current, item.id))}
              >
                {title}
              </button>
            ) : href && isOpenable && (material || contentResource) ? (
              <a
                href={href}
                rel={material ? (materialIsDownloadable ? undefined : "noreferrer") : (contentResourceIsFile ? undefined : "noreferrer")}
                target={material ? (materialIsDownloadable ? undefined : "_blank") : (contentResourceIsFile ? undefined : "_blank")}
              >
                {title}
              </a>
            ) : href && isOpenable ? <Link href={href}>{title}</Link> : title}
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
                  {t(releasedGrade.gradeKind === "final" ? "groupPage.finalGradeLabel" : "groupPage.latestGradeLabel")}: {formatScore(releasedGrade.score, releasedGrade.maxScore)}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        {isRootAccordionFolder ? null : (
          <div className="table-actions">
            {href && isOpenable ? (
              material || contentResource ? (
                <a
                  aria-label={t((material ? materialIsDownloadable : contentResourceIsFile) ? "courseDetail.downloadMaterial" : "courseDetail.openMaterial", { title })}
                  className="button secondary icon-button"
                  href={href}
                  rel={(material ? materialIsDownloadable : contentResourceIsFile) ? undefined : "noreferrer"}
                  target={(material ? materialIsDownloadable : contentResourceIsFile) ? undefined : "_blank"}
                  title={t((material ? materialIsDownloadable : contentResourceIsFile) ? "common.download" : "common.open")}
                >
                  <AppIcon name={(material ? materialIsDownloadable : contentResourceIsFile) ? "download" : "open"} />
                </a>
              ) : (
                <Link aria-label={t("courseDetail.openContentItem", { title })} className="button secondary icon-button" href={href} title={t("common.open")}>
                  <AppIcon name="open" />
                </Link>
              )
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (!contentReady) return <p>{t("common.loading")}</p>;
  if (!rootContentItems.length) return <p className="muted">{t("courseDetail.noContentItems")}</p>;

  if (layout === "folder_tabs") {
    if (!selectedRootFolder) return <div className="table-list">{rootLooseItems.map((item) => renderRow(item, 0))}</div>;
    const selectedFolderRows = flattenContentItemsFromParent(studentContentItems, selectedRootFolder.id, collapsedFolderIds, 1);
    const navigationItems = rootFolders.map((folder) => ({
      href: folderHref(folder.id),
      id: folder.id,
      isActive: folder.id === selectedRootFolder.id,
      label: titleFor(folder),
      text: t("courseDetail.studentFolderTabText", { count: flattenContentItemsFromParent(studentContentItems, folder.id, new Set(), 1).length })
    }));
    return (
      <div className="settings-layout student-content-folder-tabs">
        <SettingsSectionNav ariaLabel={t("courseDetail.studentFolderTabsNavLabel")} items={navigationItems} />
        <div className="stack">
          <section className="student-folder-tab-panel stack">
            <h3>{titleFor(selectedRootFolder)}</h3>
            {selectedFolderRows.length ? (
              <div className="table-list">
                {selectedFolderRows.map(({ item, depth }) => renderRow(item, normalizeStudentFolderTabDepth(depth)))}
              </div>
            ) : <p className="muted">{t("courseDetail.noContentItems")}</p>}
          </section>
          {rootLooseItems.length ? (
            <section className="student-folder-tab-panel stack">
              <h3>{t("courseDetail.studentRootContentTitle")}</h3>
              <div className="table-list">{rootLooseItems.map((item) => renderRow(item, 0))}</div>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="table-list">
      {rootContentItems.map((item) => {
        if (item.kind !== "folder") return renderRow(item, 0);
        const childRows = openRootFolderIds.has(item.id)
          ? flattenContentItemsFromParent(studentContentItems, item.id, collapsedFolderIds, 1)
          : [];
        return (
          <div className={`student-accordion-section ${openRootFolderIds.has(item.id) ? "is-open" : ""}`} key={item.id}>
            {renderRow(item, 0, { isRootAccordionFolder: true })}
            {childRows.length ? <div className="student-accordion-panel">{childRows.map(({ item: child, depth }) => renderRow(child, depth))}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function legacyMaterialHref(downloadUrl: string, material: CourseMaterial | CourseGroupMaterial) {
  if (legacyMaterialHasStoredFile(material)) return withDownloadVersion(downloadUrl, material);
  return material.url ?? null;
}

function legacyMaterialHasStoredFile(material: CourseMaterial | CourseGroupMaterial) {
  return typeof material.metadata?.storedName === "string";
}

function withDownloadVersion(url: string, material: CourseMaterial | CourseGroupMaterial | CourseContentResource) {
  const version = typeof material.metadata?.storedName === "string"
    ? material.metadata.storedName
    : typeof material.metadata?.originalName === "string"
      ? material.metadata.originalName
      : null;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

function compareContentItems(left: CourseContentItem, right: CourseContentItem) {
  return left.position - right.position || (left.titleSnapshot ?? "").localeCompare(right.titleSnapshot ?? "");
}

function flattenContentItemsFromParent(contentItems: CourseContentItem[], parentId: string, collapsedFolderIds: Set<string>, startingDepth: number) {
  const byParent = new Map<string, CourseContentItem[]>();
  for (const item of contentItems) {
    const itemParentId = item.parentId ?? "root";
    byParent.set(itemParentId, [...(byParent.get(itemParentId) ?? []), item]);
  }
  for (const [itemParentId, children] of byParent) byParent.set(itemParentId, children.sort(compareContentItems));
  const rows: Array<{ item: CourseContentItem; depth: number }> = [];
  const visited = new Set<string>();
  function walk(currentParentId: string, depth: number) {
    for (const item of byParent.get(currentParentId) ?? []) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      rows.push({ item, depth });
      if (item.kind === "folder" && !collapsedFolderIds.has(item.id)) walk(item.id, depth + 1);
    }
  }
  walk(parentId, startingDepth);
  return rows;
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function setsAreEqual(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function getAvailabilityStatus(availableFrom: string | null | undefined, availableUntil: string | null | undefined, now: number) {
  if (availableFrom && new Date(availableFrom).getTime() > now) return "upcoming" as const;
  if (availableUntil && new Date(availableUntil).getTime() < now) return "expired" as const;
  return "available" as const;
}

function formatAvailabilityWindow(availableFrom: string | null | undefined, availableUntil: string | null | undefined, t: Translate) {
  if (!availableFrom && !availableUntil) return t("groupPage.availableAlways");
  if (availableFrom && availableUntil) return t("groupPage.availableWindow", { from: formatAvailabilityValue(availableFrom), until: formatAvailabilityValue(availableUntil) });
  if (availableFrom) return t("groupPage.availableAfter", { from: formatAvailabilityValue(availableFrom) });
  return t("groupPage.availableBefore", { until: formatAvailabilityValue(availableUntil as string) });
}

function formatAvailabilityValue(value: string) {
  const date = new Date(value);
  const isMidnight = date.getHours() === 0
    && date.getMinutes() === 0
    && date.getSeconds() === 0
    && date.getMilliseconds() === 0;
  return new Intl.DateTimeFormat(undefined, isMidnight
    ? { year: "numeric", month: "short", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false, hourCycle: "h23" }
  ).format(date);
}

function formatScore(score: number | null, maxScore: number) {
  return score === null ? "-" : `${formatNumber(score)} / ${formatNumber(maxScore)}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
