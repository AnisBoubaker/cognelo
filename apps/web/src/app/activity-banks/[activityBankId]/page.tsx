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
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityTypeIcon, AppIcon } from "@/components/app-icon";
import { api, ApiError, type ActivityBank, type ActivityDefinition, type ActivityType, type BankActivity } from "@/lib/api";
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<ActivityCategoryId>("generic");
  const [comparingActivity, setComparingActivity] = useState<BankActivity | null>(null);
  const [fromVersionId, setFromVersionId] = useState("");
  const [toVersionId, setToVersionId] = useState("");
  const [versionDiff, setVersionDiff] = useState<ActivityVersionDiff | null>(null);
  const [versionDiffLoading, setVersionDiffLoading] = useState(false);
  const [versionDiffError, setVersionDiffError] = useState("");

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

  async function createBankActivity(selectedActivityTypeKey: string) {
    if (!bank) {
      return;
    }
    setSavingActivity(true);
    setError("");
    try {
      const definition = activityDefinitions.find((candidate) => candidate.key === selectedActivityTypeKey);
      const localized = definition?.i18n?.[locale];
      const activity = await api.createBankActivity(bank.id, {
        title: localized?.defaultTitle ?? definition?.name ?? activityTypeLabel(selectedActivityTypeKey),
        activityTypeKey: selectedActivityTypeKey,
        description: localized?.description ?? definition?.description ?? "",
        lifecycle: "draft",
        config: definition?.defaultConfig ?? {},
        metadata: {},
        position: bank.activities?.length ?? 0
      });
      setShowActivityPicker(false);
      await loadPage();
      router.push(`/activity-banks/${bank.id}/activities/${activity.activity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.createActivityError"));
    } finally {
      setSavingActivity(false);
    }
  }

  function beginEditing(activity: BankActivity) {
    setEditingActivity({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      lifecycle: activity.lifecycle as EditingActivityState["lifecycle"],
      activityTypeKey: activity.activityType.key
    });
  }

  async function saveActivityEdit(event: FormEvent) {
    event.preventDefault();
    if (!bank || !editingActivity) {
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      await api.updateBankActivity(bank.id, editingActivity.id, {
        title: editingActivity.title,
        description: editingActivity.description,
        lifecycle: editingActivity.lifecycle,
        activityTypeKey: editingActivity.activityTypeKey
      });
      setEditingActivity(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBankDetail.updateActivityError"));
    } finally {
      setSavingEdit(false);
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
    return definition?.provider?.kind !== "core" && (!definition?.creationScopes || definition.creationScopes.includes("bank"));
  });
  const visibleActivityCategories = activityCategories.filter((category) =>
    bankActivityTypes.some((type) => activityTypeCreatesCategory(type.key, category.id))
  );
  const visibleActivityTypes = bankActivityTypes.filter((type) => activityTypeBelongsToCategory(type.key, selectedCategoryId));

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
            <button className="secondary" type="button" onClick={() => setShowActivityPicker(true)}>
              {t("activityBankDetail.addActivityTitle")}
            </button>
          </div>

          {bank?.activities?.length ? (
            <div className="table-list activity-bank-activities-table">
              <div className="table-row table-head" aria-hidden="true">
                <span>{t("activityBankDetail.titleHeader")}</span>
                <span>{t("activityBankDetail.typeHeader")}</span>
                <span>{t("activityBankDetail.statusHeader")}</span>
                <span>{t("activityBankDetail.versionHeader")}</span>
              </div>
              {bank.activities.map((activity) => (
                <div
                  className="table-row activity-bank-activity-row"
                  key={activity.id}
                >
                  <Link
                    aria-label={t("activityBankDetail.editActivityLink", { title: activity.title })}
                    className="activity-bank-activity-row-link"
                    href={`/activity-banks/${bank.id}/activities/${activity.id}`}
                  />
                  <div className="table-main table-main-stack">
                    <strong>{activity.title}</strong>
                    {activity.activityType.key !== "mcq" ? (
                      <span className="table-meta-note muted">{activity.description || t("common.noDescription")}</span>
                    ) : null}
                  </div>
                  <span className="eyebrow">{activityTypeLabel(activity.activityType.key)}</span>
                  <span className="table-meta muted">{t(`activityLifecycle.${activity.lifecycle}`)}</span>
                  <div className="table-actions">
                    <span className="table-meta muted">{activity.currentVersion
                      ? activity.lifecycle === "draft"
                        ? t("activityBankDetail.unpublishedChanges", { version: activity.currentVersion.versionNumber })
                        : `v${activity.currentVersion.versionNumber}`
                      : t("activityBankDetail.notPublished")}</span>
                    <div className="content-header-actions" data-activity-actions>
                      <button
                        aria-expanded={activityActionMenuId === activity.id}
                        aria-haspopup="menu"
                        aria-label={t("activityBankDetail.activityActions", { title: activity.title })}
                        className="secondary icon-button"
                        onClick={(event) => { const opening = activityActionMenuId !== activity.id; setActivityActionMenuId(opening ? activity.id : null); setActivityActionMenuAnchor(opening ? event.currentTarget : null); }}
                        title={t("activityBankDetail.activityActionsTitle")}
                        type="button"
                      >
                        <span aria-hidden="true">•••</span>
                      </button>
                      <ContextMenu anchor={activityActionMenuAnchor} className="content-context-menu" open={activityActionMenuId === activity.id} onClose={() => { setActivityActionMenuId(null); setActivityActionMenuAnchor(null); }}>
                          <Link className="content-context-menu-item" href={`/activity-banks/${bank.id}/activities/${activity.id}`} role="menuitem">
                            <EditIcon />
                            <span>{t("common.edit")}</span>
                          </Link>
                          <button className="content-context-menu-item" disabled={duplicatingActivityId === activity.id} onClick={() => { setActivityActionMenuId(null); setDuplicatingActivity(activity); setDuplicateTitle(defaultDuplicateBankActivityTitle(activity.title)); }} role="menuitem" type="button">
                            <DuplicateIcon />
                            <span>{t("activityBankDetail.duplicateActivity")}</span>
                          </button>
                          <button className="content-context-menu-item" onClick={() => { setActivityActionMenuId(null); setMovingActivity(activity); setMoveTargetBankId(""); }} role="menuitem" type="button">
                            <MoveIcon />
                            <span>{t("activityBankDetail.moveActivity")}</span>
                          </button>
                          {(activity.versions?.length ?? 0) >= 2 ? (
                            <button className="content-context-menu-item" onClick={() => openVersionComparison(activity)} role="menuitem" type="button">
                              <CompareIcon />
                              <span>{t("bankActivityPage.compareVersions")}</span>
                            </button>
                          ) : null}
                          <button
                            className="content-context-menu-item is-danger"
                            disabled={deletingActivityId === activity.id}
                            onClick={() => {
                              setActivityActionMenuId(null);
                              setDeleteActivityState({ activity, courseCount: null });
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <RemoveIcon />
                            <span>{t("common.remove")}</span>
                          </button>
                      </ContextMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("activityBankDetail.noActivities")}</p>
          )}
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
