"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { EditActionBar, RichTextEditor, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubjectKnowledgeGraph } from "@/components/subject-knowledge-graph";
import { api, type Subject, type SubjectKnowledgeConcept, type SubjectKnowledgeGraphDraft, type SubjectKnowledgePrerequisite } from "@/lib/api";
import { locales, useI18n, type Locale } from "@/lib/i18n";

export default function EditSubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;
  const router = useRouter();
  const { locale, t } = useI18n();
  const { notify } = useNotifications();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teachingLanguage, setTeachingLanguage] = useState<Locale>("en");
  const [graphConcepts, setGraphConcepts] = useState<SubjectKnowledgeConcept[]>([]);
  const [graphPrerequisites, setGraphPrerequisites] = useState<SubjectKnowledgePrerequisite[]>([]);
  const [knowledgeGraphDeletions, setKnowledgeGraphDeletions] = useState<{ conceptIds: string[]; skillIds: string[] }>({ conceptIds: [], skillIds: [] });
  const [savedSnapshot, setSavedSnapshot] = useState<{
    title: string;
    description: string;
    teachingLanguage: Locale;
    concepts: SubjectKnowledgeConcept[];
    prerequisites: SubjectKnowledgePrerequisite[];
  }>({ title: "", description: "", teachingLanguage: "en", concepts: [], prerequisites: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiGenerationEnabled, setAiGenerationEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"information" | "knowledge-graph">("information");

  useEffect(() => {
    api
      .subject(subjectId)
      .then((result) => {
        setSubject(result.subject);
        setTitle(result.subject.title);
        setDescription(result.subject.description ?? "");
        setTeachingLanguage(result.subject.teachingLanguage);
        const concepts = result.subject.knowledgeConcepts ?? [];
        const prerequisites = result.subject.knowledgePrerequisites ?? [];
        setGraphConcepts(concepts);
        setGraphPrerequisites(prerequisites);
        setKnowledgeGraphDeletions({ conceptIds: [], skillIds: [] });
        setSavedSnapshot({ title: result.subject.title, description: result.subject.description ?? "", teachingLanguage: result.subject.teachingLanguage, concepts, prerequisites });
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("editSubject.loadError")));
  }, [subjectId, t]);

  useEffect(() => {
    api.aiAgentConnections()
      .then((result) => setAiGenerationEnabled(
        result.connections.some((connection) =>
          connection.id === result.preferences.questionAuthoringAiAgentConnectionId && connection.isEnabled
        )
      ))
      .catch(() => setAiGenerationEnabled(false));
  }, []);

  const hasUnsavedChanges = title !== savedSnapshot.title
    || description !== savedSnapshot.description
    || teachingLanguage !== savedSnapshot.teachingLanguage
    || JSON.stringify({ concepts: graphConcepts, prerequisites: graphPrerequisites })
      !== JSON.stringify({ concepts: savedSnapshot.concepts, prerequisites: savedSnapshot.prerequisites });

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setTeachingLanguage(savedSnapshot.teachingLanguage);
    setGraphConcepts(savedSnapshot.concepts);
    setGraphPrerequisites(savedSnapshot.prerequisites);
    setKnowledgeGraphDeletions({ conceptIds: [], skillIds: [] });
    setError("");
  }, [savedSnapshot]);

  const saveSubjectChanges = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const knowledgeGraph: SubjectKnowledgeGraphDraft = {
        concepts: graphConcepts.map(({ id, title: conceptTitle, skills, skillRecords, positionX, positionY }) => ({
          id, title: conceptTitle, skills, skillRecords, positionX, positionY
        })),
        prerequisites: graphPrerequisites.map(({ id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle }) => ({
          id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle
        }))
      };
      const result = await api.updateSubject(subjectId, {
        title,
        description,
        teachingLanguage,
        knowledgeGraph,
        knowledgeGraphDeletions: knowledgeGraphDeletions.conceptIds.length || knowledgeGraphDeletions.skillIds.length
          ? knowledgeGraphDeletions
          : undefined
      });
      setSavedSnapshot({ title, description, teachingLanguage, concepts: graphConcepts, prerequisites: graphPrerequisites });
      router.push(`/subjects/${result.subject.id}`);
    } catch (err) {
      notify({ variant: "error", message: err instanceof Error ? err.message : t("editSubject.saveError") });
      throw err;
    } finally {
      setSaving(false);
    }
  }, [description, graphConcepts, graphPrerequisites, knowledgeGraphDeletions, notify, router, subjectId, t, teachingLanguage, title]);

  useUnsavedChangesGuard(
    useMemo(
      () => ({
        isDirty: hasUnsavedChanges,
        onSave: saveSubjectChanges,
        onDiscard: discardChanges
      }),
      [discardChanges, hasUnsavedChanges, saveSubjectChanges]
    )
  );

  async function saveSubject(event: FormEvent) {
    event.preventDefault();
    await saveSubjectChanges();
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact subject-edit-hero">
          <div className="hero-meta">
            <p className="eyebrow">{t("editSubject.eyebrow")}</p>
            <h1>{subject?.title ?? t("editSubject.fallbackTitle")}</h1>
            <p className="muted">{t("editSubject.pageHelp")}</p>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {subject ? (
          <>
            <div className="tab-strip" role="tablist" aria-label={t("editSubject.tabsLabel")}>
              <button type="button" role="tab" aria-selected={activeTab === "information"} aria-controls="subject-information-panel" onClick={() => setActiveTab("information")}>
                {t("editSubject.informationTab")}
              </button>
              <button type="button" role="tab" aria-selected={activeTab === "knowledge-graph"} aria-controls="subject-knowledge-graph-panel" onClick={() => setActiveTab("knowledge-graph")}>
                {t("editSubject.knowledgeGraphTab")}
              </button>
            </div>

            <section className="section stack subject-details-section subject-editor-tab-panel" id="subject-information-panel" role="tabpanel" hidden={activeTab !== "information"}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{t("editSubject.detailsEyebrow")}</p>
                  <h2>{t("editSubject.detailsTitle")}</h2>
                  <p className="muted">{t("editSubject.detailsHelp")}</p>
                </div>
              </div>
              <form className="form subject-details-form" id="subject-metadata-form" onSubmit={saveSubject}>
                <div className="field">
                  <label htmlFor="subject-title">{t("subjects.titleLabel")}</label>
                  <input id="subject-title" value={title} minLength={2} required onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="subject-description">{t("subjects.descriptionLabel")}</label>
                  <RichTextEditor
                    id="subject-description"
                    value={description}
                    locale={locale}
                    minHeight={220}
                    ariaLabel={t("subjects.descriptionLabel")}
                    onChange={setDescription}
                  />
                </div>
                <div className="field subject-language-field">
                  <label htmlFor="subject-teaching-language">{t("subjects.teachingLanguageLabel")}</label>
                  <select id="subject-teaching-language" value={teachingLanguage} onChange={(event) => setTeachingLanguage(event.target.value as Locale)}>
                    {locales.map((language) => <option key={language} value={language}>{t(`locale.${language}`)}</option>)}
                  </select>
                  <p className="muted">{t("subjects.teachingLanguageHelp")}</p>
                </div>
              </form>
            </section>
            <div className="subject-editor-tab-panel" id="subject-knowledge-graph-panel" role="tabpanel" hidden={activeTab !== "knowledge-graph"}>
              <SubjectKnowledgeGraph
                aiGenerationEnabled={aiGenerationEnabled}
                subjectId={subject.id}
                subjectDescription={description}
                teachingLanguage={teachingLanguage}
                isVisible={activeTab === "knowledge-graph"}
                initialConcepts={graphConcepts}
                initialPrerequisites={graphPrerequisites}
                savedConcepts={savedSnapshot.concepts}
                savedPrerequisites={savedSnapshot.prerequisites}
                onChange={(graph) => {
                  setGraphConcepts(graph.concepts.map((concept) => ({ ...concept, subjectId, skillRecords: (concept.skillRecords ?? []).map((skill) => ({ ...skill, subjectId, conceptId: concept.id })) })));
                  setGraphPrerequisites(graph.prerequisites.map((prerequisite) => ({ ...prerequisite, subjectId })));
                }}
                onPersistedDeletion={({ conceptId, skillId }) => {
                  setSavedSnapshot((current) => ({
                    ...current,
                    concepts: skillId
                      ? current.concepts.map((concept) => concept.id === conceptId
                        ? { ...concept, skillRecords: concept.skillRecords.filter((skill) => skill.id !== skillId), skills: concept.skillRecords.filter((skill) => skill.id !== skillId).map((skill) => skill.title).join("\n") }
                        : concept)
                      : current.concepts.filter((concept) => concept.id !== conceptId),
                    prerequisites: skillId ? current.prerequisites : current.prerequisites.filter((edge) => edge.sourceConceptId !== conceptId && edge.requiredConceptId !== conceptId)
                  }));
                  setKnowledgeGraphDeletions((current) => ({
                    conceptIds: current.conceptIds.filter((id) => id !== conceptId),
                    skillIds: skillId ? current.skillIds.filter((id) => id !== skillId) : current.skillIds
                  }));
                }}
                onAiGeneratedDeletions={setKnowledgeGraphDeletions}
              />
            </div>
            <EditActionBar
              isDirty={hasUnsavedChanges}
              isSaving={saving}
              savedLabel={t("editSubject.noUnsavedChanges")}
              unsavedLabel={t("editSubject.unsavedChanges")}
              saveLabel={t("common.save")}
              savingLabel={t("common.saving")}
              cancelLabel={t("common.cancel")}
              cancelHref={`/subjects/${subject.id}`}
              onSave={() => void saveSubjectChanges()}
            />
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
