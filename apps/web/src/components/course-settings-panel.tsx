"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
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
  const initialStudentSupportAgentId = getCourseAiSettings(course).studentSupportAiAgentConnectionId;
  const [studentSupportAgentId, setStudentSupportAgentId] = useState(initialStudentSupportAgentId);
  const [savedStudentSupportAgentId, setSavedStudentSupportAgentId] = useState(initialStudentSupportAgentId);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  useEffect(() => {
    setStudentSupportAgentId(initialStudentSupportAgentId);
    setSavedStudentSupportAgentId(initialStudentSupportAgentId);
  }, [initialStudentSupportAgentId]);

  const saveAiSettings = useCallback(async () => {
    setIsSavingAiSettings(true);
    try {
      const result = await api.updateCourseSettings(course.id, {
        studentSupportAiAgentConnectionId: studentSupportAgentId || null
      });
      setSavedStudentSupportAgentId(studentSupportAgentId);
      onCourseUpdated(result.course);
      notifications.success(t("courseDetail.aiSettingsSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("courseDetail.settingsSaveError");
      notifications.error(message);
      throw error;
    } finally {
      setIsSavingAiSettings(false);
    }
  }, [course.id, notifications, onCourseUpdated, studentSupportAgentId, t]);

  const discardAiSettings = useCallback(() => {
    setStudentSupportAgentId(savedStudentSupportAgentId);
  }, [savedStudentSupportAgentId]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: studentSupportAgentId !== savedStudentSupportAgentId,
        onSave: saveAiSettings,
        onDiscard: discardAiSettings
      }),
      [discardAiSettings, saveAiSettings, savedStudentSupportAgentId, studentSupportAgentId]
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

              {aiAgentConnections.length ? null : <p className="muted">{t("courseDetail.noAiAgentsAvailable")}</p>}

              <div className="row">
                <button disabled={isSavingAiSettings} type="submit">
                  {isSavingAiSettings ? t("common.saving") : t("courseDetail.saveAiSettings")}
                </button>
              </div>
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
    return { studentSupportAiAgentConnectionId: "" };
  }
  const record = aiSettings as Record<string, unknown>;
  return {
    studentSupportAiAgentConnectionId: typeof record.studentSupportAiAgentConnectionId === "string"
      ? record.studentSupportAiAgentConnectionId
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
