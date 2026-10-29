"use client";

import { DialogHeader } from "@cognelo/activity-ui";

import { toZonedDateTimeInput, fromZonedDateTimeInput, useApplicationTime } from "@cognelo/activity-ui";

import { getActivityDefinition } from "@cognelo/activity-sdk";
import "@cognelo/plugin-registry/activity";
import type { ActivityAssignmentOverrideField, AssignedActivityAssessmentMode } from "@cognelo/contracts";
import { useBodyScrollLock, useDialogs } from "@cognelo/activity-ui";
import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import {
  api,
  ApiError,
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
  timeLimitEnabled: boolean;
  timeLimitMinutes: string;
  isVisible: boolean;
  requireSafeExamBrowser: boolean;
  gradeChallengesEnabled: boolean;
};
type GroupAssignmentDraft = AssignmentValueDraft & {
  groupId: string;
  title: string;
  assigned: boolean;
  overrideFields: ActivityAssignmentOverrideField[];
  students: CourseActivityAssignmentSettings["groups"][number]["students"];
  teams: CourseActivityAssignmentSettings["groups"][number]["teams"];
  exceptions: ExceptionDraft[];
};
type ExceptionDraft = AssignmentValueDraft & { key: string; teamId: string | null; participantId: string | null; overrideFields: ActivityAssignmentOverrideField[] };
type ActivitySettingsDraft = {
  assessmentMode: AssignedActivityAssessmentMode;
  messagingEnabled: boolean;
  twoWayMessagingEnabled: boolean;
  releaseSolution: boolean;
    hideAfterAttempts: boolean;
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

export function ActivitySettingsModal(props: ActivitySettingsDialogProps & { title?: string }) {
  const { t } = useI18n();
  const titleId = useId();
  useBodyScrollLock(true);
  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-panel activity-settings-dialog" role="dialog">
        <DialogHeader className="section-heading" closeLabel={t("common.close")} onClose={props.onClose}>
          <div>
            <p className="eyebrow">{t("courseDetail.contentSettingsEyebrow")}</p>
            <h2 id={titleId}>{props.title ?? props.activity.title}</h2>
          </div>
        </DialogHeader>
        <ActivitySettingsDialog {...props} />
      </section>
    </div>
  );
}

const summativeOverrideFields = new Set<ActivityAssignmentOverrideField>([
  "requireSafeExamBrowser",
  "gradeChallenges",
  "pointsPossible",
  "grading",
  "attempts",
  "gradeStrategy"
]);

export function ActivitySettingsDialog({ activity, courseId, onClose, onSaved }: ActivitySettingsDialogProps) {
  const { timeZone } = useApplicationTime();
  const { t } = useI18n();
  const dialogs = useDialogs();
  const [activeTab, setActiveTab] = useState<ActivitySettingsTab>("general");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [draft, setDraft] = useState<ActivitySettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAssessmentMode, setSavedAssessmentMode] = useState<AssignedActivityAssessmentMode | null>(null);
  const isTest = activity.activityType.key === "test";
  const supportsAiFeedback = getActivityDefinition(activity.activityType.key)?.grading?.supportsAiFeedback === true;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.courseActivityAssignmentSettings(courseId, activity.id)
      .then(({ settings }) => {
        if (cancelled) return;
        const nextDraft = buildDraft(settings, isTest, timeZone);
        setDraft(nextDraft);
        setSavedAssessmentMode(nextDraft.assessmentMode);
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
  }, [activity.id, courseId, isTest, t, timeZone]);

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

  function changeAssessmentMode(mode: AssignedActivityAssessmentMode) {
    setDraft((current) => {
      if (!current) return current;
      if (mode === "summative") return { ...current, assessmentMode: mode };
      return {
        ...current,
        assessmentMode: mode,
        general: { ...current.general, requireSafeExamBrowser: false, gradeChallengesEnabled: false },
        groups: current.groups.map((group) => ({
          ...group,
          requireSafeExamBrowser: false,
          gradeChallengesEnabled: false,
          overrideFields: group.overrideFields.filter((field) => !summativeOverrideFields.has(field)),
          exceptions: group.exceptions.map((exception) => ({ ...exception, overrideFields: exception.overrideFields.filter((field) => !summativeOverrideFields.has(field)) }))
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
    const convertsSummativeToFormative = savedAssessmentMode === "summative" && draft.assessmentMode !== "summative";
    if (convertsSummativeToFormative && !await dialogs.confirm({
      message: t("groupPage.summativeToFormativeConfirm"),
      confirmVariant: "danger"
    })) return;
    setSaving(true);
    setError("");
    try {
      const allowedGroupFields = draft.assessmentMode === "summative"
        ? undefined
        : (field: ActivityAssignmentOverrideField) => !summativeOverrideFields.has(field);
      const input = {
        availableFrom: toIsoOrNull(draft.general.availableFrom, timeZone),
        availableUntil: toIsoOrNull(draft.general.availableUntil, timeZone),
        timeLimitMinutes: buildTimeLimitMinutes(draft.general),
        enablePerGroupSettings: true,
        assessmentMode: draft.assessmentMode,
        messagingEnabled: draft.messagingEnabled,
        twoWayMessagingEnabled: draft.twoWayMessagingEnabled,
        releaseSolution: draft.releaseSolution,
        hideAfterAttempts: draft.hideAfterAttempts,
        confirmSummativeToFormative: convertsSummativeToFormative,
        requireSafeExamBrowser: draft.assessmentMode === "summative" && draft.general.requireSafeExamBrowser,
        gradeChallengesEnabled: draft.assessmentMode === "summative" && draft.general.gradeChallengesEnabled,
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
          exceptions: group.assigned ? group.exceptions.map((exception) => ({
            teamId: exception.teamId, participantId: exception.participantId,
            overrideFields: exception.overrideFields.filter((field) => allowedGroupFields ? allowedGroupFields(field) : true),
            availableFrom: toIsoOrNull(exception.availableFrom, timeZone), availableUntil: toIsoOrNull(exception.availableUntil, timeZone),
            timeLimitMinutes: buildTimeLimitMinutes(exception), requireSafeExamBrowser: exception.requireSafeExamBrowser,
            gradeChallengesEnabled: exception.gradeChallengesEnabled, gradebookSettings: buildGradebookSettings(exception),
            contentPlacement: { isVisible: exception.isVisible, metadata: {} }
          })) : [],
          overrideFields: group.assigned
            ? group.overrideFields.filter((field) => allowedGroupFields ? allowedGroupFields(field) : true)
            : [],
          availableFrom: toIsoOrNull(group.availableFrom, timeZone),
          availableUntil: toIsoOrNull(group.availableUntil, timeZone),
          timeLimitMinutes: buildTimeLimitMinutes(group),
          requireSafeExamBrowser: draft.assessmentMode === "summative" && group.requireSafeExamBrowser,
          gradeChallengesEnabled: draft.assessmentMode === "summative" && group.gradeChallengesEnabled,
          gradebookSettings: buildGradebookSettings(group),
          contentPlacement: {
            parentId: draft.contentParentId || null,
            titleSnapshot: activity.title,
            isVisible: group.isVisible,
            metadata: {}
          }
        }))
      };
      try {
        await api.assignActivityToAllCourseGroups(courseId, activity.id, input);
      } catch (saveError) {
        if (!(saveError instanceof ApiError) || saveError.code !== "ACTIVITY_SETTINGS_ACTIVE_STUDENTS") throw saveError;
        const confirmation = {
          title: t("courseDetail.liveSettingsTitle"),
          message: t("courseDetail.liveSettingsWarning"),
          confirmLabel: t("courseDetail.liveSettingsApply")
        };
        const canNotify = (saveError.details as { canNotifyStudents?: boolean } | undefined)?.canNotifyStudents === true;
        const message = canNotify
          ? await dialogs.prompt({ ...confirmation, inputLabel: t("courseDetail.liveSettingsMessage"), maxLength: 4000 })
          : await dialogs.confirm(confirmation) ? "" : null;
        if (message === null) return;
        await api.assignActivityToAllCourseGroups(courseId, activity.id, {
          ...input, confirmActiveStudents: true, studentMessage: message
        });
      }
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
                        onChange={(event) => changeAssessmentMode(event.target.value as AssignedActivityAssessmentMode)}
                      >
                        <option value="formative">{t("groupPage.assessmentModeFormative")}</option>
                        {supportsAiFeedback ? <option value="formative_ai">{t("groupPage.assessmentModeFormativeAi")}</option> : null}
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
                  <TimeLimitField
                    disabled={saving}
                    idPrefix={`activity-settings-general-${activity.id}`}
                    value={draft.general}
                    onChange={updateGeneral}
                  />
                  <div>
                    <label className="checkbox-row" htmlFor={`activity-settings-messaging-${activity.id}`}>
                      <input
                        aria-describedby={`activity-settings-messaging-help-${activity.id}`}
                        checked={draft.messagingEnabled}
                        disabled={saving}
                        id={`activity-settings-messaging-${activity.id}`}
                        type="checkbox"
                        onChange={(event) => setDraft((current) => current ? { ...current, messagingEnabled: event.target.checked } : current)}
                      />
                      {t("activityMessenger.enabledLabel")}
                    </label>
                    <p className="muted" id={`activity-settings-messaging-help-${activity.id}`}>{t("activityMessenger.enabledHelp")}</p>
                    {draft.messagingEnabled ? <label className="checkbox-row" htmlFor={`activity-settings-two-way-${activity.id}`}>
                      <input id={`activity-settings-two-way-${activity.id}`} type="checkbox" disabled={saving}
                        checked={draft.twoWayMessagingEnabled}
                        onChange={(event) => setDraft((current) => current ? { ...current, twoWayMessagingEnabled: event.target.checked } : current)} />
                      {t("activityMessenger.twoWayLabel")}
                    </label> : null}
                  </div>
                  <div>
                    <label className="checkbox-row" htmlFor={`activity-settings-hide-after-attempts-${activity.id}`}>
                      <input type="checkbox" id={`activity-settings-hide-after-attempts-${activity.id}`} checked={draft.hideAfterAttempts} disabled={saving}
                        onChange={(event) => setDraft((current) => current ? { ...current, hideAfterAttempts: event.target.checked } : current)} />
                      {t("activityContentAccess.setting")}
                    </label>
                    <p className="muted">{t("activityContentAccess.settingHelp")}</p>
                  </div>
                  {getActivityDefinition(activity.activityType.key)?.supportsSolution ? (
                    <div>
                      <label className="checkbox-row" htmlFor={`activity-settings-solution-${activity.id}`}>
                        <input
                          aria-describedby={`activity-settings-solution-help-${activity.id}`}
                          checked={draft.releaseSolution}
                          disabled={saving}
                          id={`activity-settings-solution-${activity.id}`}
                          type="checkbox"
                          onChange={(event) => setDraft((current) => current ? { ...current, releaseSolution: event.target.checked } : current)}
                        />
                        {t("activitySolution.releaseLabel")}
                      </label>
                      <p className="muted" id={`activity-settings-solution-help-${activity.id}`}>{t("activitySolution.releaseHelp")}</p>
                    </div>
                  ) : null}
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
                        <AppIcon name="assign" />
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
                          <AssignmentOverrideFields group={selectedGroup} summative={draft.assessmentMode === "summative"} disabled={saving} onChange={(update) => updateGroup(selectedGroup.groupId, update)} onToggle={(field, checked) => toggleGroupOverride(selectedGroup.groupId, field, checked)} />
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}

              {!loading && draft && activeTab === "exceptions" ? <section aria-labelledby="activity-settings-tab-exceptions" className="activity-settings-panel stack" id="activity-settings-panel-exceptions" role="tabpanel">
                <h3>{t("activityExceptions.title")}</h3>
                <p className="muted">{t("activityExceptions.precedence")}</p>
                <div className="field"><label htmlFor="exception-section">{t("studentGroupings.section")}</label><select id="exception-section" value={selectedGroup?.groupId ?? ""} disabled={saving} onChange={(event) => setSelectedGroupId(event.target.value)}>{draft.groups.map((group) => <option key={group.groupId} value={group.groupId}>{group.title}</option>)}</select></div>
                {selectedGroup?.assigned ? <ExceptionsEditor key={selectedGroup.groupId} group={selectedGroup} general={draft.general} summative={draft.assessmentMode === "summative"} disabled={saving} onChange={(exceptions) => updateGroup(selectedGroup.groupId, { exceptions })} /> : <p className="muted">{t("activityExceptions.assignSectionFirst")}</p>}
              </section> : null}
              {!loading && draft && activeTab === "ai" ? (
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
              <AppIcon name="close" />
              {t("common.cancel")}
            </button>
            <button disabled={saving || loading || !draft} type="submit">
              <AppIcon name="save" />
              {saving ? t("common.saving") : t("courseDetail.activitySettingsSave")}
            </button>
          </div>
    </form>
  );
}

function ExceptionsEditor({ group, general, summative, disabled, onChange }: {
  group: GroupAssignmentDraft; general: AssignmentValueDraft; summative: boolean; disabled: boolean;
  onChange: (exceptions: ExceptionDraft[]) => void;
}) {
  const { t } = useI18n();
  const [selectedKey, setSelectedKey] = useState("");
  const [teamId, setTeamId] = useState("");
  const [participantId, setParticipantId] = useState("");
  const selected = group.exceptions.find((exception) => exception.key === selectedKey) ?? group.exceptions[0];
  const sectionValues = group.overrideFields.reduce((value, field) => ({ ...value, ...copyGeneralField(group, field) }), general);
  const label = (exception: ExceptionDraft) => {
    if (exception.teamId) {
      const team = group.teams.find((team) => team.id === exception.teamId);
      return team ? `${team.groupingTitle} · ${team.title}` : t("activityExceptions.removedTarget");
    }
    const student = group.students.find((student) => student.id === exception.participantId);
    return student ? `${student.firstName} ${student.lastName} (${student.email})` : t("activityExceptions.removedTarget");
  };
  function add(kind: "team" | "student") {
    const id = kind === "team" ? teamId : participantId;
    if (!id) return;
    const key = `${kind}-${id}`;
    onChange([...group.exceptions, { ...sectionValues, key, teamId: kind === "team" ? id : null, participantId: kind === "student" ? id : null, overrideFields: [] }]);
    setSelectedKey(key);
    if (kind === "team") setTeamId(""); else setParticipantId("");
  }
  function edit(update: Partial<ExceptionDraft>) {
    if (selected) onChange(group.exceptions.map((exception) => exception.key === selected.key ? { ...exception, ...update } : exception));
  }
  function move(exception: ExceptionDraft, direction: number) {
    const teams = group.exceptions.filter((item) => item.teamId);
    const destination = teams[teams.indexOf(exception) + direction];
    if (!destination) return;
    const next = [...group.exceptions];
    const from = next.indexOf(exception), to = next.indexOf(destination);
    [next[from], next[to]] = [next[to]!, next[from]!];
    onChange(next);
  }
  return <div className="stack activity-exceptions">
    <p className="muted">{t("activityExceptions.inheritanceHelp")}</p>
    {(["team", "student"] as const).map((kind) => <section className="activity-exception-list stack" key={kind} aria-label={t(`activityExceptions.${kind}Exceptions`)}>
      <h4>{t(`activityExceptions.${kind}Exceptions`)}</h4>
      {kind === "team" ? <p className="muted">{t("activityExceptions.priorityHelp")}</p> : null}
      <div className="activity-exception-add">
        <div className="field"><label htmlFor={`exception-${kind}-target`}>{t(`activityExceptions.choose${kind === "team" ? "Team" : "Student"}`)}</label>
          <select id={`exception-${kind}-target`} value={kind === "team" ? teamId : participantId} disabled={disabled} onChange={(event) => kind === "team" ? setTeamId(event.target.value) : setParticipantId(event.target.value)}>
            <option value="">{t("activityExceptions.selectTarget")}</option>
            {kind === "team" ? group.teams.filter((team) => !group.exceptions.some((exception) => exception.teamId === team.id)).map((team) => <option key={team.id} value={team.id}>{team.groupingTitle} · {team.title}</option>)
              : group.students.filter((student) => !group.exceptions.some((exception) => exception.participantId === student.id)).map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} ({student.email})</option>)}
          </select>
        </div>
        <button type="button" className="secondary" disabled={disabled || !(kind === "team" ? teamId : participantId)} onClick={() => add(kind)}><AppIcon name="add" /> {t("activityExceptions.add")}</button>
      </div>
      {group.exceptions.filter((exception) => kind === "team" ? exception.teamId : exception.participantId).map((exception, index, entries) => <div className="activity-exception-row" key={exception.key}>
        <button type="button" className={`secondary activity-exception-select${selected?.key === exception.key ? " is-active" : ""}`} aria-pressed={selected?.key === exception.key} disabled={disabled} onClick={() => setSelectedKey(exception.key)}>{kind === "team" ? `${index + 1}. ` : ""}{label(exception)}</button>
        <div className="activity-exception-row-actions">
          {kind === "team" ? <><button type="button" className="secondary" aria-label={t("activityExceptions.higherPriority", { name: label(exception) })} disabled={disabled || index === 0} onClick={() => move(exception, -1)}><AppIcon name="up" /></button><button type="button" className="secondary" aria-label={t("activityExceptions.lowerPriority", { name: label(exception) })} disabled={disabled || index === entries.length - 1} onClick={() => move(exception, 1)}><AppIcon name="down" /></button></> : null}
          <button type="button" className="secondary" aria-label={t("activityExceptions.remove", { name: label(exception) })} disabled={disabled} onClick={() => onChange(group.exceptions.filter((item) => item.key !== exception.key))}><AppIcon name="remove" /> {t("common.remove")}</button>
        </div>
      </div>)}
    </section>)}
    {selected ? <section className="activity-exception-editor stack" aria-label={t("activityExceptions.edit")}>
      <h4>{label(selected)}</h4>
      <AssignmentOverrideFields group={{ ...selected, groupId: selected.key }} summative={summative} disabled={disabled} onChange={edit} onToggle={(field, checked) => edit({
        ...(checked ? copyGeneralField(sectionValues, field) : {}),
        overrideFields: checked ? [...new Set([...selected.overrideFields, field])] : selected.overrideFields.filter((value) => value !== field)
      })} />
    </section> : <p className="muted">{t("activityExceptions.empty")}</p>}
  </div>;
}

function AssignmentOverrideFields({ group, summative, disabled, onChange, onToggle }: {
  group: AssignmentValueDraft & { groupId: string; overrideFields: ActivityAssignmentOverrideField[] };
  summative: boolean; disabled: boolean;
  onChange: (update: Partial<AssignmentValueDraft>) => void;
  onToggle: (field: ActivityAssignmentOverrideField, checked: boolean) => void;
}) {
  const { t } = useI18n();
  return <>                          <OverrideField
                            checked={group.overrideFields.includes("availableFrom")}
                            disabled={disabled}
                            id={`activity-group-from-${group.groupId}`}
                            label={t("groupPage.availableFrom")}
                            onToggle={(checked) => onToggle("availableFrom", checked)}
                          >
                            <DateTimeMinuteInput
                              disabled={disabled}
                              id={`activity-group-from-value-${group.groupId}`}
                              value={group.availableFrom}
                              onChange={(availableFrom) => onChange({ availableFrom })}
                            />
                          </OverrideField>
                          <OverrideField
                            checked={group.overrideFields.includes("availableUntil")}
                            disabled={disabled}
                            id={`activity-group-until-${group.groupId}`}
                            label={t("groupPage.availableUntil")}
                            onToggle={(checked) => onToggle("availableUntil", checked)}
                          >
                            <DateTimeMinuteInput
                              disabled={disabled}
                              id={`activity-group-until-value-${group.groupId}`}
                              value={group.availableUntil}
                              onChange={(availableUntil) => onChange({ availableUntil })}
                            />
                          </OverrideField>
                          <OverrideField
                            checked={group.overrideFields.includes("timeLimit")}
                            disabled={disabled}
                            id={`activity-group-time-limit-${group.groupId}`}
                            label={t("groupPage.timeLimit")}
                            onToggle={(checked) => onToggle("timeLimit", checked)}
                          >
                            <TimeLimitField
                              disabled={disabled}
                              idPrefix={`activity-group-time-limit-value-${group.groupId}`}
                              value={group}
                              onChange={(update) => onChange(update)}
                            />
                          </OverrideField>
                          <OverrideField
                            checked={group.overrideFields.includes("visibility")}
                            disabled={disabled}
                            id={`activity-group-visible-${group.groupId}`}
                            label={t("courseDetail.contentVisibleLabel")}
                            onToggle={(checked) => onToggle("visibility", checked)}
                          >
                            <label className="checkbox-row" htmlFor={`activity-group-visible-value-${group.groupId}`}>
                              <input
                                checked={group.isVisible}
                                disabled={disabled}
                                id={`activity-group-visible-value-${group.groupId}`}
                                type="checkbox"
                                onChange={(event) => onChange({ isVisible: event.target.checked })}
                              />
                              <span>{t("courseDetail.contentVisibleLabel")}</span>
                            </label>
                          </OverrideField>
                          {summative ? (
                            <GroupSummativeOverrides
                              disabled={disabled}
                              group={group}
                              onChange={(update) => onChange(update)}
                              onToggle={(field, checked) => onToggle(field, checked)}
                            />
                          ) : null}</>;
}

function TimeLimitField({
  disabled,
  idPrefix,
  value,
  onChange
}: {
  disabled: boolean;
  idPrefix: string;
  value: Pick<AssignmentValueDraft, "timeLimitEnabled" | "timeLimitMinutes">;
  onChange: (update: Partial<AssignmentValueDraft>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="stack stack-tight">
      <label className="checkbox-row" htmlFor={`${idPrefix}-enabled`}>
        <input
          checked={value.timeLimitEnabled}
          disabled={disabled}
          id={`${idPrefix}-enabled`}
          type="checkbox"
          onChange={(event) => onChange({ timeLimitEnabled: event.target.checked })}
        />
        <span>
          {t("groupPage.timeLimitEnabled")}
          <small className="muted">{t("groupPage.timeLimitHelp")}</small>
        </span>
      </label>
      {value.timeLimitEnabled ? (
        <div className="field">
          <label htmlFor={`${idPrefix}-minutes`}>{t("groupPage.timeLimitMinutes")}</label>
          <input
            disabled={disabled}
            id={`${idPrefix}-minutes`}
            max="1440"
            min="1"
            step="1"
            type="number"
            value={value.timeLimitMinutes}
            onChange={(event) => onChange({ timeLimitMinutes: event.target.value })}
          />
        </div>
      ) : null}
    </div>
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
      <label className="checkbox-row" htmlFor={`${idPrefix}-grade-challenges`}>
        <input
          checked={value.gradeChallengesEnabled}
          disabled={disabled}
          id={`${idPrefix}-grade-challenges`}
          type="checkbox"
          onChange={(event) => onChange({ gradeChallengesEnabled: event.target.checked })}
        />
        <span>
          {t("groupPage.gradeChallengesEnabled")}
          <small className="muted">{t("groupPage.gradeChallengesEnabledHelp")}</small>
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
  group: AssignmentValueDraft & { groupId: string; overrideFields: ActivityAssignmentOverrideField[] };
  onChange: (update: Partial<AssignmentValueDraft>) => void;
  onToggle: (field: ActivityAssignmentOverrideField, checked: boolean) => void;
}) {
  const { t } = useI18n();
  const fields: Array<{ field: ActivityAssignmentOverrideField; label: string }> = [
    { field: "requireSafeExamBrowser", label: t("groupPage.requireSafeExamBrowser") },
    { field: "gradeChallenges", label: t("groupPage.gradeChallengesEnabled") },
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
          {field === "requireSafeExamBrowser" || field === "gradeChallenges" ? (
            <label className="checkbox-row" htmlFor={`activity-group-${field}-value-${group.groupId}`}>
              <input
                checked={field === "requireSafeExamBrowser" ? group.requireSafeExamBrowser : group.gradeChallengesEnabled}
                disabled={disabled}
                id={`activity-group-${field}-value-${group.groupId}`}
                type="checkbox"
                onChange={(event) => onChange(field === "requireSafeExamBrowser"
                  ? { requireSafeExamBrowser: event.target.checked }
                  : { gradeChallengesEnabled: event.target.checked })}
              />
              <span>{field === "requireSafeExamBrowser" ? t("groupPage.requireSafeExamBrowser") : t("groupPage.gradeChallengesEnabled")}</span>
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

function buildDraft(settings: CourseActivityAssignmentSettings, isTest: boolean, timeZone: string = "UTC"): ActivitySettingsDraft {
  const assessmentMode = isTest ? "summative" : settings.general.assessmentMode;
  return {
    assessmentMode,
    messagingEnabled: settings.general.messagingEnabled,
    twoWayMessagingEnabled: settings.general.twoWayMessagingEnabled,
    releaseSolution: settings.general.releaseSolution ?? false,
    hideAfterAttempts: settings.general.hideAfterAttempts ?? false,
    contentParentId: settings.general.contentPlacement.parentId ?? "",
    general: assignmentValueDraft(settings.general, timeZone),
    groups: settings.groups.map((group) => ({
      ...assignmentValueDraft(group, timeZone),
      groupId: group.groupId,
      title: group.title,
      assigned: group.assigned,
      students: group.students,
      teams: group.teams,
      exceptions: group.exceptions.map((exception) => ({
        ...assignmentValueDraft({
          ...group,
          ...exception,
          availableFrom: exception.availableFrom ?? null,
          availableUntil: exception.availableUntil ?? null,
          timeLimitMinutes: exception.timeLimitMinutes ?? null,
          requireSafeExamBrowser: exception.requireSafeExamBrowser ?? false,
          gradeChallengesEnabled: exception.gradeChallengesEnabled ?? false,
          gradebookSettings: { ...group.gradebookSettings, ...exception.gradebookSettings },
          contentPlacement: { ...group.contentPlacement, ...exception.contentPlacement }
        }, timeZone),
        key: exception.teamId ? `team-${exception.teamId}` : `student-${exception.participantId}`,
        teamId: exception.teamId ?? null, participantId: exception.participantId ?? null,
        overrideFields: exception.overrideFields
      })),
      overrideFields: assessmentMode === "summative"
        ? group.overrideFields
        : group.overrideFields.filter((field) => !summativeOverrideFields.has(field))
    }))
  };
}

function assignmentValueDraft(value: {
  availableFrom: string | null;
  availableUntil: string | null;
  timeLimitMinutes: number | null;
  requireSafeExamBrowser: boolean;
  gradeChallengesEnabled: boolean;
  gradebookSettings: ActivityAssignmentGradebookSettings;
  contentPlacement: { parentId: string | null; isVisible: boolean };
}, timeZone: string = "UTC"): AssignmentValueDraft {
  return {
    availableFrom: toDateTimeLocalValue(value.availableFrom, timeZone),
    availableUntil: toDateTimeLocalValue(value.availableUntil, timeZone),
    timeLimitEnabled: value.timeLimitMinutes !== null,
    timeLimitMinutes: String(value.timeLimitMinutes ?? 60),
    isVisible: value.contentPlacement.isVisible,
    requireSafeExamBrowser: value.requireSafeExamBrowser,
    gradeChallengesEnabled: value.gradeChallengesEnabled,
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

function copyGeneralField(general: AssignmentValueDraft, field: ActivityAssignmentOverrideField): Partial<AssignmentValueDraft> {
  switch (field) {
    case "availableFrom": return { availableFrom: general.availableFrom };
    case "availableUntil": return { availableUntil: general.availableUntil };
    case "timeLimit": return {
      timeLimitEnabled: general.timeLimitEnabled,
      timeLimitMinutes: general.timeLimitMinutes
    };
    case "visibility": return { isVisible: general.isVisible };
    case "requireSafeExamBrowser": return { requireSafeExamBrowser: general.requireSafeExamBrowser };
    case "gradeChallenges": return { gradeChallengesEnabled: general.gradeChallengesEnabled };
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
  if (!group.overrideFields.includes("timeLimit")) {
    if (update.timeLimitEnabled !== undefined) inherited.timeLimitEnabled = update.timeLimitEnabled;
    if (update.timeLimitMinutes !== undefined) inherited.timeLimitMinutes = update.timeLimitMinutes;
  }
  if (!group.overrideFields.includes("visibility") && update.isVisible !== undefined) {
    inherited.isVisible = update.isVisible;
  }
  if (!group.overrideFields.includes("requireSafeExamBrowser") && update.requireSafeExamBrowser !== undefined) {
    inherited.requireSafeExamBrowser = update.requireSafeExamBrowser;
  }
  if (!group.overrideFields.includes("gradeChallenges") && update.gradeChallengesEnabled !== undefined) {
    inherited.gradeChallengesEnabled = update.gradeChallengesEnabled;
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

function buildTimeLimitMinutes(value: Pick<AssignmentValueDraft, "timeLimitEnabled" | "timeLimitMinutes">) {
  if (!value.timeLimitEnabled) return null;
  return Math.min(1440, Math.max(1, Math.floor(positiveNumber(value.timeLimitMinutes, 60))));
}

function positiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toDateTimeLocalValue(value: string | null | undefined, timeZone: string = "UTC") { return toZonedDateTimeInput(value, timeZone); }

function toIsoOrNull(value: string, timeZone: string = "UTC") { return fromZonedDateTimeInput(value, timeZone); }
