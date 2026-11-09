"use client";
import { HelpLabel } from "@cognelo/activity-ui";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { aiAgentModels, type AiModelSelection } from "@cognelo/contracts";
import { AiModelPicker, EditActionBar, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { CourseMaterialEmbeddingSettings } from "./course-material-embedding-settings";
import { CourseForm } from "@/components/course-form";
import { CourseTimeSettings } from "@/components/course-time-settings";
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
  const initialSupportModel = initialAiSettings.studentSupportAiAgentModel;
  const initialFeedbackModel = initialAiSettings.assessmentFeedbackAiAgentModel;
  const [supportModel, setSupportModel] = useState(initialSupportModel), [savedSupportModel, setSavedSupportModel] = useState(initialSupportModel);
  const [feedbackModel, setFeedbackModel] = useState(initialFeedbackModel), [savedFeedbackModel, setSavedFeedbackModel] = useState(initialFeedbackModel);
  const initialAutomaticFeedbackEnabled = initialAiSettings.automaticFeedbackEnabled;
  const [studentSupportAgentId, setStudentSupportAgentId] = useState(initialStudentSupportAgentId);
  const [savedStudentSupportAgentId, setSavedStudentSupportAgentId] = useState(initialStudentSupportAgentId);
  const [assessmentFeedbackAgentId, setAssessmentFeedbackAgentId] = useState(initialAssessmentFeedbackAgentId);
  const [savedAssessmentFeedbackAgentId, setSavedAssessmentFeedbackAgentId] = useState(initialAssessmentFeedbackAgentId);
  const [automaticFeedbackEnabled, setAutomaticFeedbackEnabled] = useState(initialAutomaticFeedbackEnabled);
  const [savedAutomaticFeedbackEnabled, setSavedAutomaticFeedbackEnabled] = useState(initialAutomaticFeedbackEnabled);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  useEffect(() => {
    setSupportModel(initialSupportModel); setSavedSupportModel(initialSupportModel);
    setFeedbackModel(initialFeedbackModel); setSavedFeedbackModel(initialFeedbackModel);
    setStudentSupportAgentId(initialStudentSupportAgentId);
    setSavedStudentSupportAgentId(initialStudentSupportAgentId);
    setAssessmentFeedbackAgentId(initialAssessmentFeedbackAgentId);
    setSavedAssessmentFeedbackAgentId(initialAssessmentFeedbackAgentId);
    setAutomaticFeedbackEnabled(initialAutomaticFeedbackEnabled);
    setSavedAutomaticFeedbackEnabled(initialAutomaticFeedbackEnabled);
  }, [initialAssessmentFeedbackAgentId, initialAutomaticFeedbackEnabled, initialStudentSupportAgentId, initialSupportModel, initialFeedbackModel]);

  const saveAiSettings = useCallback(async () => {
    setIsSavingAiSettings(true);
    try {
      const result = await api.updateCourseSettings(course.id, {
        studentSupportAiAgentConnectionId: studentSupportAgentId || null,
        studentSupportAiAgentModel: supportModel || null,
        assessmentFeedbackAiAgentModel: feedbackModel || null,
        automaticFeedbackEnabled,
        assessmentFeedbackAiAgentConnectionId: assessmentFeedbackAgentId || null
      });
      setSavedSupportModel(supportModel); setSavedFeedbackModel(feedbackModel);
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
  }, [assessmentFeedbackAgentId, automaticFeedbackEnabled, course.id, notifications, onCourseUpdated, studentSupportAgentId, supportModel, feedbackModel, t]);

  const discardAiSettings = useCallback(() => {
    setSupportModel(savedSupportModel); setFeedbackModel(savedFeedbackModel);
    setStudentSupportAgentId(savedStudentSupportAgentId);
    setAssessmentFeedbackAgentId(savedAssessmentFeedbackAgentId);
    setAutomaticFeedbackEnabled(savedAutomaticFeedbackEnabled);
  }, [savedAssessmentFeedbackAgentId, savedAutomaticFeedbackEnabled, savedStudentSupportAgentId, savedSupportModel, savedFeedbackModel]);

  const aiSettingsDirty = supportModel !== savedSupportModel || feedbackModel !== savedFeedbackModel || studentSupportAgentId !== savedStudentSupportAgentId ||
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

  function pickerValue(connectionId: string, selectedModel: string): AiModelSelection | null {
    if (!connectionId) return null;
    const connection = aiAgentConnections.find(item => item.id === connectionId);
    const models = connection ? aiAgentModels(connection).filter(item => item.purpose === "generation") : [];
    return { connectionId, model: selectedModel || models.find(item => item.model === connection?.model)?.model || models[0]?.model || "" };
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
                <HelpLabel help={<>{t("courseDetail.generalSettingsText")}</>}><h2>{t("courseDetail.generalSettingsTitle")}</h2></HelpLabel>

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

        {activeSection === "general" ? <CourseTimeSettings /> : null}

        {activeSection === "ai" ? (
          <section className="section stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("courseDetail.settingsEyebrow")}</p>
                <HelpLabel help={<>{t("courseDetail.aiSettingsText")}</>}><h2>{t("courseDetail.aiSettingsTitle")}</h2></HelpLabel>

              </div>
            </div>

            <form className="form" id="course-ai-settings-form" onSubmit={handleAiSubmit}>
              <AiModelPicker connectionHelp={t("courseDetail.studentSupportAgentHelp")} connections={aiAgentConnections} purpose="generation" value={pickerValue(studentSupportAgentId, supportModel)}
                onChange={selection => { setStudentSupportAgentId(selection?.connectionId ?? ""); setSupportModel(selection?.model ?? ""); }}
                labels={{ connection: t("courseDetail.studentSupportAgent"), model: t("settings.aiAgentModel"), inherit: t("courseDetail.noAiAgentSelected"), unavailable: t("settings.aiModelUnavailable"), noModels: t("settings.aiNoGenerationModels") }} />

              <HelpLabel help={t("courseDetail.automaticFeedbackEnabledHelp")}><label className="checkbox-row">
                <input
                  checked={automaticFeedbackEnabled}
                  type="checkbox"
                  onChange={(event) => setAutomaticFeedbackEnabled(event.target.checked)}
                />
                <span>
                  <strong>{t("courseDetail.automaticFeedbackEnabled")}</strong>
                </span>
              </label></HelpLabel>

              <AiModelPicker connectionHelp={t("courseDetail.assessmentFeedbackAgentHelp")} connections={aiAgentConnections} purpose="generation" value={pickerValue(assessmentFeedbackAgentId, feedbackModel)} disabled={!automaticFeedbackEnabled}
                onChange={selection => { setAssessmentFeedbackAgentId(selection?.connectionId ?? ""); setFeedbackModel(selection?.model ?? ""); }}
                labels={{ connection: t("courseDetail.assessmentFeedbackAgent"), model: t("settings.aiAgentModel"), inherit: t("courseDetail.noAiAgentSelected"), unavailable: t("settings.aiModelUnavailable"), noModels: t("settings.aiNoGenerationModels") }} />

              {aiAgentConnections.length ? null : <p className="muted">{t("courseDetail.noAiAgentsAvailable")}</p>}

              <EditActionBar
                form="course-ai-settings-form"
                isDirty={aiSettingsDirty}
                isSaving={isSavingAiSettings}
                savedLabel={t("common.savedStatus")}
                unsavedLabel={t("common.unsavedStatus")}
                saveLabel={t("courseDetail.saveAiSettings")}
                savingLabel={t("common.saving")}
                cancelLabel={t("common.cancel")}
                onCancel={discardAiSettings}
              />
            </form>
          </section>
        ) : null}
        {activeSection === "ai" ? <CourseMaterialEmbeddingSettings courseId={course.id} /> : null}
      </div>
    </div>
  );
}

function getCourseAiSettings(course: Course) {
  const aiSettings = course.metadata?.aiSettings;
  if (!aiSettings || typeof aiSettings !== "object" || Array.isArray(aiSettings)) {
    return {
      studentSupportAiAgentConnectionId: "",
      studentSupportAiAgentModel: "", assessmentFeedbackAiAgentModel: "",
      automaticFeedbackEnabled: false,
      assessmentFeedbackAiAgentConnectionId: ""
    };
  }
  const record = aiSettings as Record<string, unknown>;
  return {
    studentSupportAiAgentModel: typeof record.studentSupportAiAgentModel === "string" ? record.studentSupportAiAgentModel : "",
    assessmentFeedbackAiAgentModel: typeof record.assessmentFeedbackAiAgentModel === "string" ? record.assessmentFeedbackAiAgentModel : "",
    studentSupportAiAgentConnectionId: typeof record.studentSupportAiAgentConnectionId === "string"
      ? record.studentSupportAiAgentConnectionId
      : "",
    automaticFeedbackEnabled: record.automaticFeedbackEnabled === true,
    assessmentFeedbackAiAgentConnectionId: typeof record.assessmentFeedbackAiAgentConnectionId === "string"
      ? record.assessmentFeedbackAiAgentConnectionId
      : ""
  };
}
