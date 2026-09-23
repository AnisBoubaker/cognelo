"use client";

import type { ActivityAssignmentOverrideField } from "@cognelo/contracts";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import {
  api,
  type Activity,
  type ActivityAssignmentGradebookSettings,
  type CourseActivityAssignmentSettings
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type ActivitySettingsTab = "general" | "groups" | "ai" | "exceptions";
type GradebookDraft = {
  pointsPossible: string;
  gradingMode: "points" | "pass_fail";
  passThresholdPoints: string;
  passThresholdOutOf: string;
  attemptLimitMode: "unlimited" | "max_attempts" | "until_due";
  maxAttempts: string;
  gradeStrategy: "latest" | "best" | "first" | "weighted_average";
  dropLowestAttempt: boolean;
};
type AssignmentValueDraft = GradebookDraft & {
  availableFrom: string;
  availableUntil: string;
  isVisible: boolean;
  requireSafeExamBrowser: boolean;
};
type GroupAssignmentDraft = AssignmentValueDraft & {
  groupId: string;
  title: string;
  assigned: boolean;
  overrideFields: ActivityAssignmentOverrideField[];
};
type ActivitySettingsDraft = {
  assessmentMode: "formative" | "summative";
  contentParentId: string;
  general: AssignmentValueDraft;
  groups: GroupAssignmentDraft[];
};

type ActivitySettingsDialogProps = {
  activity: Activity;
  courseId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const summativeOverrideFields = new Set<ActivityAssignmentOverrideField>([
  "requireSafeExamBrowser",
  "pointsPossible",
  "grading",
  "attempts",
  "gradeStrategy"
]);

export function ActivitySettingsDialog({ activity, courseId, onClose, onSaved }: ActivitySettingsDialogProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ActivitySettingsTab>("general");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [draft, setDraft] = useState<ActivitySettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isTest = activity.activityType.key === "test";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.courseActivityAssignmentSettings(courseId, activity.id)
      .then(({ settings }) => {
        if (cancelled) return;
        const nextDraft = buildDraft(settings, isTest);
        setDraft(nextDraft);
        setSelectedGroupId(nextDraft.groups[0]?.groupId ?? "");
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t("courseDetail.activitySettingsLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activity.id, courseId, isTest, t]);

  const selectedGroup = useMemo(
    () => draft?.groups.find((group) => group.groupId === selectedGroupId) ?? draft?.groups[0] ?? null,
    [draft, selectedGroupId]
  );

  function updateGeneral(update: Partial<AssignmentValueDraft>) {
    setDraft((current) => current ? {
      ...current,
      general: { ...current.general, ...update },
      groups: current.groups.map((group) => ({
        ...group,
        ...inheritedGeneralUpdate(group, update)
      }))
    } : current);
  }

  function updateGroup(groupId: string, update: Partial<GroupAssignmentDraft>) {
    setDraft((current) => current ? {
      ...current,
      groups: current.groups.map((group) => group.groupId === groupId ? { ...group, ...update } : group)
    } : current);
  }

  function changeAssessmentMode(mode: "formative" | "summative") {
    setDraft((current) => {
      if (!current) return current;
      if (mode === "summative") return { ...current, assessmentMode: mode };
      return {
        ...current,
        assessmentMode: mode,
        general: { ...current.general, requireSafeExamBrowser: false },
        groups: current.groups.map((group) => ({
          ...group,
          requireSafeExamBrowser: false,
          overrideFields: group.overrideFields.filter((field) => !summativeOverrideFields.has(field))
        }))
      };
    });
  }

  function toggleGroupOverride(groupId: string, field: ActivityAssignmentOverrideField, enabled: boolean) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        groups: current.groups.map((group) => {
          if (group.groupId !== groupId) return group;
          const overrideFields = enabled
            ? [...new Set([...group.overrideFields, field])]
            : group.overrideFields.filter((candidate) => candidate !== field);
          return enabled
            ? { ...group, ...copyGeneralField(current.general, field), overrideFields }
            : { ...group, overrideFields };
        })
      };
    });
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const allowedGroupFields = draft.assessmentMode === "summative"
        ? undefined
        : (field: ActivityAssignmentOverrideField) => !summativeOverrideFields.has(field);
      await api.assignActivityToAllCourseGroups(courseId, activity.id, {
        availableFrom: toIsoOrNull(draft.general.availableFrom),
        availableUntil: toIsoOrNull(draft.general.availableUntil),
        enablePerGroupSettings: true,
        assessmentMode: draft.assessmentMode,
        requireSafeExamBrowser: draft.assessmentMode === "summative" && draft.general.requireSafeExamBrowser,
        gradebookSettings: buildGradebookSettings(draft.general),
        contentPlacement: {
          parentId: draft.contentParentId || null,
          titleSnapshot: activity.title,
          isVisible: draft.general.isVisible,
          metadata: {}
        },
        groupAssignments: draft.groups.map((group) => ({
          groupId: group.groupId,
          assigned: group.assigned,
          overrideFields: group.assigned
            ? group.overrideFields.filter((field) => allowedGroupFields ? allowedGroupFields(field) : true)
            : [],
          availableFrom: toIsoOrNull(group.availableFrom),
          availableUntil: toIsoOrNull(group.availableUntil),
          requireSafeExamBrowser: draft.assessmentMode === "summative" && group.requireSafeExamBrowser,
          gradebookSettings: buildGradebookSettings(group),
          contentPlacement: {
            parentId: draft.contentParentId || null,
            titleSnapshot: activity.title,
            isVisible: group.isVisible,
            metadata: {}
          }
        }))
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("courseDetail.activitySettingsSaveError"));
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: ActivitySettingsTab; label: string }> = [
    { id: "general", label: t("courseDetail.activitySettingsGeneralTab") },
    { id: "groups", label: t("courseDetail.activitySettingsGroupsTab") },
    { id: "ai", label: t("courseDetail.activitySettingsAiTab") },
    { id: "exceptions", label: t("courseDetail.activitySettingsExceptionsTab") }
  ];

  return (
    <form className="activity-settings-form" onSubmit={saveSettings}>
          <div className="activity-settings-layout">
            <nav aria-label={t("courseDetail.activitySettingsNavigation")} className="activity-settings-nav" role="tablist">
              {tabs.map((tab) => (
                <button
                  aria-controls={`activity-settings-panel-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  className={activeTab === tab.id ? "is-active" : ""}
                  id={`activity-settings-tab-${tab.id}`}
                  key={tab.id}
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="activity-settings-content">
              {loading ? <p className="muted">{t("courseDetail.activitySettingsLoading")}</p> : null}
              {!loading && draft && activeTab === "general" ? (
                <section
                  aria-labelledby="activity-settings-tab-general"
                  className="activity-settings-panel stack"
                  id="activity-settings-panel-general"
                  role="tabpanel"
                >
                  <div>
                    <h3>{t("courseDetail.activitySettingsGeneralTitle")}</h3>
                    <p className="muted">{t("courseDetail.activitySettingsGeneralText")}</p>
                  </div>
                  <div className="settings-grid">
                    <div className="field">
                      <label htmlFor={`activity-settings-mode-${activity.id}`}>{t("groupPage.assessmentMode")}</label>
                      <select
                        disabled={saving || isTest}
                        id={`activity-settings-mode-${activity.id}`}
                        value={draft.assessmentMode}
                        onChange={(event) => changeAssessmentMode(event.target.value as "formative" | "summative")}
                      >
                        <option value="formative">{t("groupPage.assessmentModeFormative")}</option>
                        <option value="summative">{t("groupPage.assessmentModeSummative")}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`activity-settings-from-${activity.id}`}>{t("groupPage.availableFrom")}</label>
                      <DateTimeMinuteInput
                        disabled={saving}
                        id={`activity-settings-from-${activity.id}`}
                        value={draft.general.availableFrom}
                        onChange={(availableFrom) => updateGeneral({ availableFrom })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`activity-settings-until-${activity.id}`}>{t("groupPage.availableUntil")}</label>
                      <DateTimeMinuteInput
                        disabled={saving}
                        id={`activity-settings-until-${activity.id}`}
                        value={draft.general.availableUntil}
                        onChange={(availableUntil) => updateGeneral({ availableUntil })}
                      />
                    </div>
                  </div>
                  <label className="checkbox-row" htmlFor={`activity-settings-visible-${activity.id}`}>
                    <input
                      checked={draft.general.isVisible}
                      disabled={saving}
                      id={`activity-settings-visible-${activity.id}`}
                      type="checkbox"
                      onChange={(event) => updateGeneral({ isVisible: event.target.checked })}
                    />
                    <span>{t("courseDetail.contentVisibleLabel")}</span>
                  </label>
                  {draft.assessmentMode === "summative" ? (
                    <SummativeFields
                      disabled={saving}
                      idPrefix={`activity-settings-general-${activity.id}`}
                      value={draft.general}
                      onChange={updateGeneral}
                    />
                  ) : null}
                </section>
              ) : null}

              {!loading && draft && activeTab === "groups" ? (
                <section
                  aria-labelledby="activity-settings-tab-groups"
                  className="activity-settings-panel activity-settings-groups-panel"
                  id="activity-settings-panel-groups"
                  role="tabpanel"
                >
                  <div className="activity-group-tabs-header">
                    <div aria-label={t("courseDetail.activitySettingsGroupTabs")} className="activity-group-tabs" role="tablist">
                      {draft.groups.map((group) => (
                        <button
                          aria-selected={selectedGroup?.groupId === group.groupId}
                          className={selectedGroup?.groupId === group.groupId ? "is-active" : ""}
                          key={group.groupId}
                          role="tab"
                          type="button"
                          onClick={() => setSelectedGroupId(group.groupId)}
                        >
                          {group.title}
                        </button>
                      ))}
                    </div>
                    {draft.groups.length ? (
                      <button
                        className="secondary activity-assign-all-button"
                        disabled={saving || draft.groups.every((group) => group.assigned)}
                        type="button"
                        onClick={() => setDraft((current) => current ? {
                          ...current,
                          groups: current.groups.map((group) => ({ ...group, assigned: true }))
                        } : current)}
                      >
                        {t("courseDetail.activitySettingsAssignAll")}
                      </button>
                    ) : null}
                  </div>

                  {!selectedGroup ? <p className="muted">{t("courseDetail.activitySettingsNoGroups")}</p> : (
                    <div className="activity-group-settings stack" role="tabpanel">
                      <label className="checkbox-row activity-assigned-toggle" htmlFor={`activity-group-assigned-${selectedGroup.groupId}`}>
                        <input
                          checked={selectedGroup.assigned}
                          disabled={saving}
                          id={`activity-group-assigned-${selectedGroup.groupId}`}
                          type="checkbox"
                          onChange={(event) => updateGroup(selectedGroup.groupId, { assigned: event.target.checked })}
                        />
                        <span>{t("courseDetail.activitySettingsAssigned")}</span>
                      </label>
                      {selectedGroup.assigned ? (
                        <div className="activity-group-overrides stack">
                          <p className="muted">{t("courseDetail.activitySettingsOverridesText")}</p>
                          <OverrideField
                            checked={selectedGroup.overrideFields.includes("availableFrom")}
                            disabled={saving}
                            id={`activity-group-from-${selectedGroup.groupId}`}
                            label={t("groupPage.availableFrom")}
                            onToggle={(checked) => toggleGroupOverride(selectedGroup.groupId, "availableFrom", checked)}
                          >
                            <DateTimeMinuteInput
                              disabled={saving}
                              id={`activity-group-from-value-${selectedGroup.groupId}`}
                              value={selectedGroup.availableFrom}
                              onChange={(availableFrom) => updateGroup(selectedGroup.groupId, { availableFrom })}
                            />
                          </OverrideField>
                          <OverrideField
                            checked={selectedGroup.overrideFields.includes("availableUntil")}
                            disabled={saving}
                            id={`activity-group-until-${selectedGroup.groupId}`}
                            label={t("groupPage.availableUntil")}
                            onToggle={(checked) => toggleGroupOverride(selectedGroup.groupId, "availableUntil", checked)}
                          >
                            <DateTimeMinuteInput
                              disabled={saving}
                              id={`activity-group-until-value-${selectedGroup.groupId}`}
                              value={selectedGroup.availableUntil}
                              onChange={(availableUntil) => updateGroup(selectedGroup.groupId, { availableUntil })}
                            />
                          </OverrideField>
                          <OverrideField
                            checked={selectedGroup.overrideFields.includes("visibility")}
                            disabled={saving}
                            id={`activity-group-visible-${selectedGroup.groupId}`}
                            label={t("courseDetail.contentVisibleLabel")}
                            onToggle={(checked) => toggleGroupOverride(selectedGroup.groupId, "visibility", checked)}
                          >
                            <label className="checkbox-row" htmlFor={`activity-group-visible-value-${selectedGroup.groupId}`}>
                              <input
                                checked={selectedGroup.isVisible}
                                disabled={saving}
                                id={`activity-group-visible-value-${selectedGroup.groupId}`}
                                type="checkbox"
                                onChange={(event) => updateGroup(selectedGroup.groupId, { isVisible: event.target.checked })}
                              />
                              <span>{t("courseDetail.contentVisibleLabel")}</span>
                            </label>
                          </OverrideField>
                          {draft.assessmentMode === "summative" ? (
                            <GroupSummativeOverrides
                              disabled={saving}
                              group={selectedGroup}
                              onChange={(update) => updateGroup(selectedGroup.groupId, update)}
                              onToggle={(field, checked) => toggleGroupOverride(selectedGroup.groupId, field, checked)}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}

              {!loading && draft && (activeTab === "ai" || activeTab === "exceptions") ? (
                <section
                  aria-labelledby={`activity-settings-tab-${activeTab}`}
                  className="activity-settings-panel activity-settings-placeholder"
                  id={`activity-settings-panel-${activeTab}`}
                  role="tabpanel"
                >
                  <p className="muted">{t("courseDetail.activitySettingsComingLater")}</p>
                </section>
              ) : null}
              {error ? <p className="error activity-settings-error">{error}</p> : null}
            </div>
          </div>

          <div className="activity-settings-actions dialog-actions">
            <button className="secondary" disabled={saving} type="button" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button disabled={saving || loading || !draft} type="submit">
              {saving ? t("common.saving") : t("courseDetail.activitySettingsSave")}
            </button>
          </div>
    </form>
  );
}

function SummativeFields({
  disabled,
  idPrefix,
  value,
  onChange
}: {
  disabled: boolean;
  idPrefix: string;
  value: AssignmentValueDraft;
  onChange: (update: Partial<AssignmentValueDraft>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="stack activity-summative-settings">
      <label className="checkbox-row" htmlFor={`${idPrefix}-seb`}>
        <input
          checked={value.requireSafeExamBrowser}
          disabled={disabled}
          id={`${idPrefix}-seb`}
          type="checkbox"
          onChange={(event) => onChange({ requireSafeExamBrowser: event.target.checked })}
        />
        <span>
          {t("groupPage.requireSafeExamBrowser")}
          <small className="muted">{t("groupPage.requireSafeExamBrowserHelp")}</small>
        </span>
      </label>
      <div className="settings-grid">
        <GradebookFields disabled={disabled} idPrefix={idPrefix} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function GroupSummativeOverrides({
  disabled,
  group,
  onChange,
  onToggle
}: {
  disabled: boolean;
  group: GroupAssignmentDraft;
  onChange: (update: Partial<GroupAssignmentDraft>) => void;
  onToggle: (field: ActivityAssignmentOverrideField, checked: boolean) => void;
}) {
  const { t } = useI18n();
  const fields: Array<{ field: ActivityAssignmentOverrideField; label: string }> = [
    { field: "requireSafeExamBrowser", label: t("groupPage.requireSafeExamBrowser") },
    { field: "pointsPossible", label: t("groupPage.pointsPossible") },
    { field: "grading", label: t("groupPage.gradingMode") },
    { field: "attempts", label: t("groupPage.attemptLimitMode") },
    { field: "gradeStrategy", label: t("groupPage.gradeStrategy") }
  ];
  return (
    <>
      {fields.map(({ field, label }) => (
        <OverrideField
          checked={group.overrideFields.includes(field)}
          disabled={disabled}
          id={`activity-group-${field}-${group.groupId}`}
          key={field}
          label={label}
          onToggle={(checked) => onToggle(field, checked)}
        >
          {field === "requireSafeExamBrowser" ? (
            <label className="checkbox-row" htmlFor={`activity-group-seb-value-${group.groupId}`}>
              <input
                checked={group.requireSafeExamBrowser}
                disabled={disabled}
                id={`activity-group-seb-value-${group.groupId}`}
                type="checkbox"
                onChange={(event) => onChange({ requireSafeExamBrowser: event.target.checked })}
              />
              <span>{t("groupPage.requireSafeExamBrowser")}</span>
            </label>
          ) : (
            <div className="settings-grid activity-group-gradebook-fields">
              <GradebookFields
                disabled={disabled}
                fields={[field]}
                idPrefix={`activity-group-${group.groupId}`}
                value={group}
                onChange={onChange}
              />
            </div>
          )}
        </OverrideField>
      ))}
    </>
  );
}

function GradebookFields({
  disabled,
  fields = ["pointsPossible", "grading", "attempts", "gradeStrategy"],
  idPrefix,
  value,
  onChange
}: {
  disabled: boolean;
  fields?: ActivityAssignmentOverrideField[];
  idPrefix: string;
  value: GradebookDraft;
  onChange: (update: Partial<GradebookDraft>) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {fields.includes("pointsPossible") ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-points`}>{t("groupPage.pointsPossible")}</label>
          <input
            disabled={disabled}
            id={`${idPrefix}-points`}
            min="0.01"
            step="0.01"
            type="number"
            value={value.pointsPossible}
            onChange={(event) => onChange({ pointsPossible: event.target.value })}
          />
        </div>
      ) : null}
      {fields.includes("grading") ? (
        <>
          <div className="field">
            <label htmlFor={`${idPrefix}-grading`}>{t("groupPage.gradingMode")}</label>
            <select
              disabled={disabled}
              id={`${idPrefix}-grading`}
              value={value.gradingMode}
              onChange={(event) => onChange({ gradingMode: event.target.value as "points" | "pass_fail" })}
            >
              <option value="points">{t("groupPage.gradingModePoints")}</option>
              <option value="pass_fail">{t("groupPage.gradingModePassFail")}</option>
            </select>
          </div>
          {value.gradingMode === "pass_fail" ? (
            <>
              <div className="field">
                <label htmlFor={`${idPrefix}-pass-points`}>{t("groupPage.passThresholdPoints")}</label>
                <input
                  disabled={disabled}
                  id={`${idPrefix}-pass-points`}
                  min="0"
                  step="0.01"
                  type="number"
                  value={value.passThresholdPoints}
                  onChange={(event) => onChange({ passThresholdPoints: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`${idPrefix}-pass-out-of`}>{t("groupPage.passThresholdOutOf")}</label>
                <input
                  disabled={disabled}
                  id={`${idPrefix}-pass-out-of`}
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={value.passThresholdOutOf}
                  onChange={(event) => onChange({ passThresholdOutOf: event.target.value })}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {fields.includes("attempts") ? (
        <>
          <div className="field">
            <label htmlFor={`${idPrefix}-attempts`}>{t("groupPage.attemptLimitMode")}</label>
            <select
              disabled={disabled}
              id={`${idPrefix}-attempts`}
              value={value.attemptLimitMode}
              onChange={(event) => onChange({ attemptLimitMode: event.target.value as GradebookDraft["attemptLimitMode"] })}
            >
              <option value="unlimited">{t("groupPage.attemptLimitUnlimited")}</option>
              <option value="max_attempts">{t("groupPage.attemptLimitMax")}</option>
              <option value="until_due">{t("groupPage.attemptLimitUntilDue")}</option>
            </select>
          </div>
          {value.attemptLimitMode === "max_attempts" ? (
            <div className="field">
              <label htmlFor={`${idPrefix}-max-attempts`}>{t("groupPage.maxAttempts")}</label>
              <input
                disabled={disabled}
                id={`${idPrefix}-max-attempts`}
                min="1"
                step="1"
                type="number"
                value={value.maxAttempts}
                onChange={(event) => onChange({ maxAttempts: event.target.value })}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {fields.includes("gradeStrategy") ? (
        <>
          <div className="field">
            <label htmlFor={`${idPrefix}-grade-strategy`}>{t("groupPage.gradeStrategy")}</label>
            <select
              disabled={disabled}
              id={`${idPrefix}-grade-strategy`}
              value={value.gradeStrategy}
              onChange={(event) => onChange({ gradeStrategy: event.target.value as GradebookDraft["gradeStrategy"] })}
            >
              <option value="latest">{t("groupPage.gradeStrategyLatest")}</option>
              <option value="best">{t("groupPage.gradeStrategyBest")}</option>
              <option value="first">{t("groupPage.gradeStrategyFirst")}</option>
              <option value="weighted_average">{t("groupPage.gradeStrategyWeightedAverage")}</option>
            </select>
          </div>
          {value.gradeStrategy === "weighted_average" ? (
            <label className="checkbox-row" htmlFor={`${idPrefix}-drop-lowest`}>
              <input
                checked={value.dropLowestAttempt}
                disabled={disabled}
                id={`${idPrefix}-drop-lowest`}
                type="checkbox"
                onChange={(event) => onChange({ dropLowestAttempt: event.target.checked })}
              />
              <span>{t("groupPage.dropLowestAttempt")}</span>
            </label>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function OverrideField({
  checked,
  children,
  disabled,
  id,
  label,
  onToggle
}: {
  checked: boolean;
  children: React.ReactNode;
  disabled: boolean;
  id: string;
  label: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className={`activity-override-field ${checked ? "is-enabled" : ""}`}>
      <label className="activity-override-toggle" htmlFor={id}>
        <input
          checked={checked}
          disabled={disabled}
          id={id}
          type="checkbox"
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {checked ? <div className="activity-override-control">{children}</div> : null}
    </div>
  );
}

function buildDraft(settings: CourseActivityAssignmentSettings, isTest: boolean): ActivitySettingsDraft {
  const assessmentMode = isTest ? "summative" : settings.general.assessmentMode;
  return {
    assessmentMode,
    contentParentId: settings.general.contentPlacement.parentId ?? "",
    general: assignmentValueDraft(settings.general),
    groups: settings.groups.map((group) => ({
      ...assignmentValueDraft(group),
      groupId: group.groupId,
      title: group.title,
      assigned: group.assigned,
      overrideFields: assessmentMode === "summative"
        ? group.overrideFields
        : group.overrideFields.filter((field) => !summativeOverrideFields.has(field))
    }))
  };
}

function assignmentValueDraft(value: {
  availableFrom: string | null;
  availableUntil: string | null;
  requireSafeExamBrowser: boolean;
  gradebookSettings: ActivityAssignmentGradebookSettings;
  contentPlacement: { parentId: string | null; isVisible: boolean };
}): AssignmentValueDraft {
  return {
    availableFrom: toDateTimeLocalValue(value.availableFrom),
    availableUntil: toDateTimeLocalValue(value.availableUntil),
    isVisible: value.contentPlacement.isVisible,
    requireSafeExamBrowser: value.requireSafeExamBrowser,
    pointsPossible: String(value.gradebookSettings.pointsPossible),
    gradingMode: value.gradebookSettings.gradingMode,
    passThresholdPoints: String(value.gradebookSettings.passThresholdPoints ?? value.gradebookSettings.pointsPossible / 2),
    passThresholdOutOf: String(value.gradebookSettings.passThresholdOutOf ?? value.gradebookSettings.pointsPossible),
    attemptLimitMode: value.gradebookSettings.attemptLimitMode,
    maxAttempts: String(value.gradebookSettings.maxAttempts ?? 1),
    gradeStrategy: value.gradebookSettings.gradeStrategy,
    dropLowestAttempt: value.gradebookSettings.dropLowestAttempt
  };
}

function copyGeneralField(general: AssignmentValueDraft, field: ActivityAssignmentOverrideField): Partial<GroupAssignmentDraft> {
  switch (field) {
    case "availableFrom": return { availableFrom: general.availableFrom };
    case "availableUntil": return { availableUntil: general.availableUntil };
    case "visibility": return { isVisible: general.isVisible };
    case "requireSafeExamBrowser": return { requireSafeExamBrowser: general.requireSafeExamBrowser };
    case "pointsPossible": return { pointsPossible: general.pointsPossible };
    case "grading": return {
      gradingMode: general.gradingMode,
      passThresholdPoints: general.passThresholdPoints,
      passThresholdOutOf: general.passThresholdOutOf
    };
    case "attempts": return { attemptLimitMode: general.attemptLimitMode, maxAttempts: general.maxAttempts };
    case "gradeStrategy": return {
      gradeStrategy: general.gradeStrategy,
      dropLowestAttempt: general.dropLowestAttempt
    };
  }
}

function inheritedGeneralUpdate(
  group: GroupAssignmentDraft,
  update: Partial<AssignmentValueDraft>
): Partial<GroupAssignmentDraft> {
  const inherited: Partial<GroupAssignmentDraft> = {};
  if (!group.overrideFields.includes("availableFrom") && update.availableFrom !== undefined) {
    inherited.availableFrom = update.availableFrom;
  }
  if (!group.overrideFields.includes("availableUntil") && update.availableUntil !== undefined) {
    inherited.availableUntil = update.availableUntil;
  }
  if (!group.overrideFields.includes("visibility") && update.isVisible !== undefined) {
    inherited.isVisible = update.isVisible;
  }
  if (!group.overrideFields.includes("requireSafeExamBrowser") && update.requireSafeExamBrowser !== undefined) {
    inherited.requireSafeExamBrowser = update.requireSafeExamBrowser;
  }
  if (!group.overrideFields.includes("pointsPossible") && update.pointsPossible !== undefined) {
    inherited.pointsPossible = update.pointsPossible;
  }
  if (!group.overrideFields.includes("grading")) {
    if (update.gradingMode !== undefined) inherited.gradingMode = update.gradingMode;
    if (update.passThresholdPoints !== undefined) inherited.passThresholdPoints = update.passThresholdPoints;
    if (update.passThresholdOutOf !== undefined) inherited.passThresholdOutOf = update.passThresholdOutOf;
  }
  if (!group.overrideFields.includes("attempts")) {
    if (update.attemptLimitMode !== undefined) inherited.attemptLimitMode = update.attemptLimitMode;
    if (update.maxAttempts !== undefined) inherited.maxAttempts = update.maxAttempts;
  }
  if (!group.overrideFields.includes("gradeStrategy")) {
    if (update.gradeStrategy !== undefined) inherited.gradeStrategy = update.gradeStrategy;
    if (update.dropLowestAttempt !== undefined) inherited.dropLowestAttempt = update.dropLowestAttempt;
  }
  return inherited;
}

function buildGradebookSettings(value: GradebookDraft): ActivityAssignmentGradebookSettings {
  const pointsPossible = positiveNumber(value.pointsPossible, 100);
  return {
    pointsPossible,
    gradingMode: value.gradingMode,
    passThresholdPoints: value.gradingMode === "pass_fail" ? nonNegativeNumber(value.passThresholdPoints, pointsPossible / 2) : null,
    passThresholdOutOf: value.gradingMode === "pass_fail" ? positiveNumber(value.passThresholdOutOf, pointsPossible) : null,
    attemptLimitMode: value.attemptLimitMode,
    maxAttempts: value.attemptLimitMode === "max_attempts" ? Math.max(1, Math.floor(positiveNumber(value.maxAttempts, 1))) : null,
    gradeStrategy: value.gradeStrategy,
    dropLowestAttempt: value.gradeStrategy === "weighted_average" && value.dropLowestAttempt
  };
}

function positiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
