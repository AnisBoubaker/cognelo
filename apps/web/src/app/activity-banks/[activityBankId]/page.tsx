"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api, type ActivityBank, type ActivityDefinition, type ActivityType, type BankActivity } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type EditingActivityState = {
  id: string;
  title: string;
  description: string;
  lifecycle: "draft" | "published" | "paused" | "archived";
  activityTypeKey: string;
};

export default function ActivityBankDetailPage() {
  const params = useParams<{ activityBankId: string }>();
  const activityBankId = params.activityBankId;
  const { locale, t } = useI18n();
  const [bank, setBank] = useState<ActivityBank | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activityDefinitions, setActivityDefinitions] = useState<ActivityDefinition[]>([]);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityTypeKey, setActivityTypeKey] = useState("placeholder");
  const [editingActivity, setEditingActivity] = useState<EditingActivityState | null>(null);
  const [error, setError] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadPage() {
    const [bankResult, typesResult] = await Promise.all([api.activityBank(activityBankId), api.activityTypes()]);
    setBank(bankResult.activityBank);
    setActivityTypes(typesResult.activityTypes);
    setActivityDefinitions(typesResult.registeredDefinitions);
    setActivityTypeKey((current) => current || typesResult.activityTypes[0]?.key || "placeholder");
  }

  useEffect(() => {
    loadPage().catch((err) => setError(err instanceof Error ? err.message : t("activityBankDetail.loadError")));
  }, [activityBankId]);

  async function createBankActivity(event: FormEvent) {
    event.preventDefault();
    if (!bank) {
      return;
    }
    setSavingActivity(true);
    setError("");
    try {
      await api.createBankActivity(bank.id, {
        title: activityTitle,
        activityTypeKey,
        description: activityDescription,
        lifecycle: "draft",
        config: {},
        metadata: {},
        position: bank.activities?.length ?? 0
      });
      setActivityTitle("");
      setActivityDescription("");
      await loadPage();
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

  function activityTypeLabel(activityTypeKey: string) {
    const definition = activityDefinitions.find((candidate) => candidate.key === activityTypeKey);
    const localized = definition?.i18n?.[locale];
    return localized?.name ?? definition?.name ?? activityTypes.find((type) => type.key === activityTypeKey)?.name ?? activityTypeKey;
  }

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
          <h2>{t("activityBankDetail.addActivityTitle")}</h2>
          <form className="form inline-panel" onSubmit={createBankActivity}>
            <div className="grid compact-form-grid">
              <div className="field">
                <label htmlFor="bank-activity-title">{t("activityBankDetail.activityTitleLabel")}</label>
                <input
                  id="bank-activity-title"
                  value={activityTitle}
                  minLength={2}
                  required
                  onChange={(event) => setActivityTitle(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="bank-activity-type">{t("activityBankDetail.activityTypeLabel")}</label>
                <select id="bank-activity-type" value={activityTypeKey} onChange={(event) => setActivityTypeKey(event.target.value)}>
                  {activityTypes.map((type) => (
                    <option key={type.id} value={type.key}>
                      {activityTypeLabel(type.key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="bank-activity-description">{t("activityBankDetail.descriptionLabel")}</label>
              <textarea
                id="bank-activity-description"
                value={activityDescription}
                onChange={(event) => setActivityDescription(event.target.value)}
              />
            </div>
            <button type="submit" disabled={savingActivity || !bank}>
              {savingActivity ? t("common.saving") : t("common.create")}
            </button>
          </form>
        </section>

        <section className="section stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("activityBankDetail.activitiesEyebrow")}</p>
              <h2>{t("activityBankDetail.activitiesTitle")}</h2>
            </div>
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
                    <span className="table-meta-note muted">{activity.description || t("common.noDescription")}</span>
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("activityBankDetail.noActivities")}</p>
          )}
        </section>

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
                  {activityTypes.map((type) => (
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
