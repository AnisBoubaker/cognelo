"use client";

import {
  activityDefinitionBelongsToCategory,
  activityDefinitionCreatesCategory,
  listActivityCategories,
  type ActivityCategoryId
} from "@cognelo/activity-sdk/categories";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, ApiError, type ActivityBank, type ActivityDefinition, type ActivityType, type BankActivity } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type EditingActivityState = {
  id: string;
  title: string;
  description: string;
  lifecycle: "draft" | "published" | "paused" | "archived";
  activityTypeKey: string;
};

const activityCategories = listActivityCategories();

export default function ActivityBankDetailPage() {
  const params = useParams<{ activityBankId: string }>();
  const router = useRouter();
  const activityBankId = params.activityBankId;
  const { locale, t } = useI18n();
  const [bank, setBank] = useState<ActivityBank | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [editingActivity, setEditingActivity] = useState<EditingActivityState | null>(null);
  const [error, setError] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<ActivityCategoryId>("generic");

  async function loadPage() {
    const [bankResult, typesResult] = await Promise.all([api.activityBank(activityBankId), api.activityTypes()]);
    setBank(bankResult.activityBank);
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

  async function deleteActivity(activity: BankActivity) {
    if (!bank) {
      return;
    }
    const confirmed = window.confirm(t("activityBankDetail.deleteActivityConfirm", { title: activity.title }));
    if (!confirmed) {
      return;
    }

    setDeletingActivityId(activity.id);
    setError("");
    try {
      await api.deleteBankActivity(bank.id, activity.id);
      await loadPage();
    } catch (err) {
      if (err instanceof ApiError && err.code === "BANK_ACTIVITY_IN_USE") {
        const courseCount = getCourseCountFromDeleteError(err.details);
        const forceConfirmed = window.confirm(
          t("activityBankDetail.deleteActivityInUseConfirm", {
            title: activity.title,
            count: courseCount
          })
        );
        if (forceConfirmed) {
          try {
            await api.deleteBankActivity(bank.id, activity.id, { force: true });
            await loadPage();
          } catch (forceErr) {
            setError(forceErr instanceof Error ? forceErr.message : t("activityBankDetail.deleteActivityError"));
          }
          return;
        }
        return;
      }

      setError(err instanceof Error ? err.message : t("activityBankDetail.deleteActivityError"));
    } finally {
      setDeletingActivityId(null);
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
            <div className="table-list">
              <div className="table-row table-head" aria-hidden="true">
                <span>{t("activityBankDetail.titleHeader")}</span>
                <span>{t("activityBankDetail.typeHeader")}</span>
                <span>{t("activityBankDetail.statusHeader")}</span>
                <span>{t("activityBankDetail.versionHeader")}</span>
              </div>
              {bank.activities.map((activity) => (
                <div className="table-row" key={activity.id}>
                  <div className="table-main table-main-stack">
                    <strong>{activity.title}</strong>
                    {activity.activityType.key !== "mcq" ? (
                      <span className="table-meta-note muted">{activity.description || t("common.noDescription")}</span>
                    ) : null}
                  </div>
                  <span className="eyebrow">{activityTypeLabel(activity.activityType.key)}</span>
                  <span className="table-meta muted">{t(`activityLifecycle.${activity.lifecycle}`)}</span>
                  <div className="table-actions">
                    <span className="table-meta muted">v{activity.currentVersion?.versionNumber ?? 1}</span>
                    <Link
                      className="button secondary icon-button"
                      href={`/activity-banks/${bank.id}/activities/${activity.id}`}
                      title={t("common.edit")}
                    >
                      <EditIcon />
                    </Link>
                    <button
                      aria-label={t("activityBankDetail.deleteActivity", { title: activity.title })}
                      className="danger icon-button"
                      disabled={deletingActivityId === activity.id}
                      onClick={() => deleteActivity(activity)}
                      title={t("common.remove")}
                      type="button"
                    >
                      <RemoveIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("activityBankDetail.noActivities")}</p>
          )}
        </section>

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

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M12 20h9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path
        d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path d="M6 7h12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M8 7l1 13h6l1-13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
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
