"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubjectKnowledgeGraph } from "@/components/subject-knowledge-graph";
import { api, type Subject, type SubjectKnowledgeConcept, type SubjectKnowledgeGraphDraft, type SubjectKnowledgePrerequisite } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function EditSubjectPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;
  const router = useRouter();
  const { t } = useI18n();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [graphConcepts, setGraphConcepts] = useState<SubjectKnowledgeConcept[]>([]);
  const [graphPrerequisites, setGraphPrerequisites] = useState<SubjectKnowledgePrerequisite[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    title: string;
    description: string;
    concepts: SubjectKnowledgeConcept[];
    prerequisites: SubjectKnowledgePrerequisite[];
  }>({ title: "", description: "", concepts: [], prerequisites: [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiGenerationEnabled, setAiGenerationEnabled] = useState(false);

  useEffect(() => {
    api
      .subject(subjectId)
      .then((result) => {
        setSubject(result.subject);
        setTitle(result.subject.title);
        setDescription(result.subject.description ?? "");
        const concepts = result.subject.knowledgeConcepts ?? [];
        const prerequisites = result.subject.knowledgePrerequisites ?? [];
        setGraphConcepts(concepts);
        setGraphPrerequisites(prerequisites);
        setSavedSnapshot({ title: result.subject.title, description: result.subject.description ?? "", concepts, prerequisites });
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
    || JSON.stringify({ concepts: graphConcepts, prerequisites: graphPrerequisites })
      !== JSON.stringify({ concepts: savedSnapshot.concepts, prerequisites: savedSnapshot.prerequisites });

  const discardChanges = useCallback(() => {
    setTitle(savedSnapshot.title);
    setDescription(savedSnapshot.description);
    setGraphConcepts(savedSnapshot.concepts);
    setGraphPrerequisites(savedSnapshot.prerequisites);
    setError("");
  }, [savedSnapshot]);

  const saveSubjectChanges = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const knowledgeGraph: SubjectKnowledgeGraphDraft = {
        concepts: graphConcepts.map(({ id, title: conceptTitle, description: conceptDescription, positionX, positionY }) => ({
          id, title: conceptTitle, description: conceptDescription, positionX, positionY
        })),
        prerequisites: graphPrerequisites.map(({ id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle }) => ({
          id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle
        }))
      };
      const result = await api.updateSubject(subjectId, { title, description, knowledgeGraph });
      setSavedSnapshot({ title, description, concepts: graphConcepts, prerequisites: graphPrerequisites });
      router.push(`/subjects/${result.subject.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("editSubject.saveError"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [description, graphConcepts, graphPrerequisites, router, subjectId, t, title]);

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
        <section>
          <p className="eyebrow">{t("editSubject.eyebrow")}</p>
          <h1>{subject?.title ?? t("editSubject.fallbackTitle")}</h1>
        </section>

        {error ? <p className="error">{error}</p> : null}

        {subject ? (
          <section className="section stack">
            <form className="form" id="subject-metadata-form" onSubmit={saveSubject}>
              <div className="field">
                <label htmlFor="subject-title">{t("subjects.titleLabel")}</label>
                <input id="subject-title" value={title} minLength={2} required onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="subject-description">{t("subjects.descriptionLabel")}</label>
                <textarea id="subject-description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
            </form>
            <SubjectKnowledgeGraph
              aiGenerationEnabled={aiGenerationEnabled}
              subjectId={subject.id}
              subjectDescription={description}
              initialConcepts={graphConcepts}
              initialPrerequisites={graphPrerequisites}
              savedConcepts={savedSnapshot.concepts}
              savedPrerequisites={savedSnapshot.prerequisites}
              onChange={(graph) => {
                setGraphConcepts(graph.concepts.map((concept) => ({ ...concept, subjectId })));
                setGraphPrerequisites(graph.prerequisites.map((prerequisite) => ({ ...prerequisite, subjectId })));
              }}
            />
            <div className="hero-actions">
              <button type="submit" form="subject-metadata-form" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
              <Link className="button secondary" href={`/subjects/${subject.id}`}>
                {t("common.cancel")}
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
