"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EditActionBar, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { CourseForm } from "@/components/course-form";
import { SettingsSectionNav } from "@/components/settings-nav";
import { api, type AiAgentConnection, type Course, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export type CourseSettingsSection = "ai" | "general";

export function CourseSettingsPanel({
  activeSection,
  aiAgentConnections,
  course,
  onCourseUpdated,
  subjects
}: {
  activeSection: CourseSettingsSection;
  aiAgentConnections: AiAgentConnection[];
  course: Course;
  onCourseUpdated: (course: Course) => void;
  subjects: Subject[];
}) {
  const { t } = useI18n();
  const notifications = useNotifications();
  const initialAiSettings = getCourseAiSettings(course);
  const initialStudentSupportAgentId = initialAiSettings.studentSupportAiAgentConnectionId;
  const initialAssessmentFeedbackAgentId = initialAiSettings.assessmentFeedbackAiAgentConnectionId;
  const initialAutomaticFeedbackEnabled = initialAiSettings.automaticFeedbackEnabled;
  const [studentSupportAgentId, setStudentSupportAgentId] = useState(initialStudentSupportAgentId);
  const [savedStudentSupportAgentId, setSavedStudentSupportAgentId] = useState(initialStudentSupportAgentId);
  const [assessmentFeedbackAgentId, setAssessmentFeedbackAgentId] = useState(initialAssessmentFeedbackAgentId);
  const [savedAssessmentFeedbackAgentId, setSavedAssessmentFeedbackAgentId] = useState(initialAssessmentFeedbackAgentId);
  const [automaticFeedbackEnabled, setAutomaticFeedbackEnabled] = useState(initialAutomaticFeedbackEnabled);
  const [savedAutomaticFeedbackEnabled, setSavedAutomaticFeedbackEnabled] = useState(initialAutomaticFeedbackEnabled);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  useEffect(() => {
    setStudentSupportAgentId(initialStudentSupportAgentId);
    setSavedStudentSupportAgentId(initialStudentSupportAgentId);
    setAssessmentFeedbackAgentId(initialAssessmentFeedbackAgentId);
    setSavedAssessmentFeedbackAgentId(initialAssessmentFeedbackAgentId);
    setAutomaticFeedbackEnabled(initialAutomaticFeedbackEnabled);
    setSavedAutomaticFeedbackEnabled(initialAutomaticFeedbackEnabled);
  }, [initialAssessmentFeedbackAgentId, initialAutomaticFeedbackEnabled, initialStudentSupportAgentId]);

  const saveAiSettings = useCallback(async () => {
    setIsSavingAiSettings(true);
    try {
      const result = await api.updateCourseSettings(course.id, {
        studentSupportAiAgentConnectionId: studentSupportAgentId || null,
        automaticFeedbackEnabled,
        assessmentFeedbackAiAgentConnectionId: assessmentFeedbackAgentId || null
      });
      setSavedStudentSupportAgentId(studentSupportAgentId);
      setSavedAssessmentFeedbackAgentId(assessmentFeedbackAgentId);
      setSavedAutomaticFeedbackEnabled(automaticFeedbackEnabled);
      onCourseUpdated(result.course);
      notifications.success(t("courseDetail.aiSettingsSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("courseDetail.settingsSaveError");
      notifications.error(message);
      throw error;
    } finally {
      setIsSavingAiSettings(false);
    }
  }, [assessmentFeedbackAgentId, automaticFeedbackEnabled, course.id, notifications, onCourseUpdated, studentSupportAgentId, t]);

  const discardAiSettings = useCallback(() => {
    setStudentSupportAgentId(savedStudentSupportAgentId);
    setAssessmentFeedbackAgentId(savedAssessmentFeedbackAgentId);
    setAutomaticFeedbackEnabled(savedAutomaticFeedbackEnabled);
  }, [savedAssessmentFeedbackAgentId, savedAutomaticFeedbackEnabled, savedStudentSupportAgentId]);

  const aiSettingsDirty = studentSupportAgentId !== savedStudentSupportAgentId ||
    assessmentFeedbackAgentId !== savedAssessmentFeedbackAgentId ||
    automaticFeedbackEnabled !== savedAutomaticFeedbackEnabled;

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: aiSettingsDirty,
        onSave: saveAiSettings,
        onDiscard: discardAiSettings
      }),
      [aiSettingsDirty, discardAiSettings, saveAiSettings]
    )
  );

  async function handleAiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveAiSettings();
    } catch {
      // The shared notification surface reports the save error.
    }
  }

  const settingsBaseHref = `/courses/${course.id}?tab=settings&section=`;
  const navigationItems = [
    {
      href: `${settingsBaseHref}general`,
      id: "general",
      isActive: activeSection === "general",
      label: t("courseDetail.generalSettingsNav"),
      text: t("courseDetail.generalSettingsNavText")
    },
    {
      href: `${settingsBaseHref}ai`,
      id: "ai",
      isActive: activeSection === "ai",
      label: t("courseDetail.aiSettingsNav"),
      text: t("courseDetail.aiSettingsNavText")
    }
  ];

  return (
    <div className="settings-layout">
      <SettingsSectionNav ariaLabel={t("courseDetail.settingsSectionNavLabel")} items={navigationItems} />

      <div className="stack">
        {activeSection === "general" ? (
          <section className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("courseDetail.settingsEyebrow")}</p>
                <h2>{t("courseDetail.generalSettingsTitle")}</h2>
                <p className="muted">{t("courseDetail.generalSettingsText")}</p>
              </div>
            </div>
            <CourseForm
              initial={course}
              showStudentContentLayout
              subjects={subjects}
              submitLabel={t("courseForm.save")}
              onSubmit={async (input) => {
                const result = await api.updateCourse(course.id, input);
                onCourseUpdated(result.course);
                notifications.success(t("courseDetail.generalSettingsSaved"));
              }}
            />
          </section>
        ) : null}

        {activeSection === "ai" ? (
          <section className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("courseDetail.settingsEyebrow")}</p>
                <h2>{t("courseDetail.aiSettingsTitle")}</h2>
                <p className="muted">{t("courseDetail.aiSettingsText")}</p>
              </div>
            </div>

            <form className="form" onSubmit={handleAiSubmit}>
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

              <label className="checkbox-row">
                <input
                  checked={automaticFeedbackEnabled}
                  type="checkbox"
                  onChange={(event) => setAutomaticFeedbackEnabled(event.target.checked)}
                />
                <span>
                  <strong>{t("courseDetail.automaticFeedbackEnabled")}</strong>
                  <span className="muted">{t("courseDetail.automaticFeedbackEnabledHelp")}</span>
                </span>
              </label>

              <div className="field">
                <label htmlFor="assessmentFeedbackAgent">{t("courseDetail.assessmentFeedbackAgent")}</label>
                <select
                  disabled={!automaticFeedbackEnabled}
                  id="assessmentFeedbackAgent"
                  required={automaticFeedbackEnabled}
                  value={assessmentFeedbackAgentId}
                  onChange={(event) => setAssessmentFeedbackAgentId(event.target.value)}
                >
                  <option value="">{t("courseDetail.noAiAgentSelected")}</option>
                  {aiAgentConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {formatAiAgentOption(connection, t)}
                    </option>
                  ))}
                </select>
                <p className="muted">{t("courseDetail.assessmentFeedbackAgentHelp")}</p>
              </div>

              {aiAgentConnections.length ? null : <p className="muted">{t("courseDetail.noAiAgentsAvailable")}</p>}

              <EditActionBar
                isDirty={aiSettingsDirty}
                isSaving={isSavingAiSettings}
                savedLabel={t("common.savedStatus")}
                unsavedLabel={t("common.unsavedStatus")}
                saveLabel={t("courseDetail.saveAiSettings")}
                savingLabel={t("common.saving")}
                cancelLabel={t("common.cancel")}
                onCancel={discardAiSettings}
                onSave={saveAiSettings}
              />
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function getCourseAiSettings(course: Course) {
  const aiSettings = course.metadata?.aiSettings;
  if (!aiSettings || typeof aiSettings !== "object" || Array.isArray(aiSettings)) {
    return {
      studentSupportAiAgentConnectionId: "",
      automaticFeedbackEnabled: false,
      assessmentFeedbackAiAgentConnectionId: ""
    };
  }
  const record = aiSettings as Record<string, unknown>;
  return {
    studentSupportAiAgentConnectionId: typeof record.studentSupportAiAgentConnectionId === "string"
      ? record.studentSupportAiAgentConnectionId
      : "",
    automaticFeedbackEnabled: record.automaticFeedbackEnabled === true,
    assessmentFeedbackAiAgentConnectionId: typeof record.assessmentFeedbackAiAgentConnectionId === "string"
      ? record.assessmentFeedbackAiAgentConnectionId
      : ""
  };
}

function formatAiAgentOption(
  connection: AiAgentConnection,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const scope = connection.scope === "global" ? t("courseDetail.aiAgentScopeGlobal") : t("courseDetail.aiAgentScopePersonal");
  return `${connection.displayName} · ${t(`aiAgentProviders.${connection.provider}`)} · ${connection.model} · ${scope}`;
}
