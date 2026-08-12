"use client";

import { ActivityKnowledgeGenerationProvider, EditActionBar, getEditActionBarCopy, useNotifications, useUnsavedChangesActions, useUnsavedChangesGuard, type ActivityKnowledgeGenerationMode, type ActivityKnowledgeGenerationRequest } from "@cognelo/activity-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import type { SubjectKnowledgeConcept, SubjectKnowledgePrerequisite } from "@/lib/api";

type ActivityEditorTabsProps = {
  children: React.ReactNode;
  concepts: SubjectKnowledgeConcept[];
  prerequisites: SubjectKnowledgePrerequisite[];
  selectedConcepts: ActivityKnowledgeConceptSelection[];
  onSaveConcepts: (selections: ActivityKnowledgeConceptSelection[]) => Promise<void>;
  onConceptDraftChange?: (selections: ActivityKnowledgeConceptSelection[]) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
};

function conceptSkills(concept: SubjectKnowledgeConcept) {
  return concept.skillRecords?.length ? concept.skillRecords.map((skill) => skill.title) : concept.skills.split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean);
}

function canonicalSelections(selections: ActivityKnowledgeConceptSelection[]) {
  return JSON.stringify(selections
    .map((selection) => ({ ...selection, selectedSkills: [...selection.selectedSkills].sort(), selectedSkillIds: [...(selection.selectedSkillIds ?? [])].sort() }))
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId)));
}

function ConceptCheckbox({ checked, partial, label, onChange }: { checked: boolean; partial: boolean; label: string; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = partial; }, [partial]);
  return <input ref={ref} type="checkbox" checked={checked} aria-label={label} onChange={(event) => onChange(event.target.checked)} />;
}

export function ActivityEditorTabs({ children, concepts, prerequisites, selectedConcepts, onSaveConcepts, onConceptDraftChange, t, locale }: ActivityEditorTabsProps) {
  const notifications = useNotifications();
  const unsavedActions = useUnsavedChangesActions();
  const [activeTab, setActiveTab] = useState<"activity" | "concepts">("activity");
  const [draftSelections, setDraftSelections] = useState(selectedConcepts);
  const [savedSelections, setSavedSelections] = useState(selectedConcepts);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [generationMode, setGenerationMode] = useState<ActivityKnowledgeGenerationMode>("selected");
  const skillsPaneRef = useRef<HTMLDivElement | null>(null);
  const selectedConceptsKeyRef = useRef(canonicalSelections(selectedConcepts));
  const isDirty = canonicalSelections(draftSelections) !== canonicalSelections(savedSelections);

  const orderedConcepts = useMemo(() => {
    const directPrerequisites = new Map<string, string[]>();
    for (const prerequisite of prerequisites) {
      directPrerequisites.set(prerequisite.sourceConceptId, [...(directPrerequisites.get(prerequisite.sourceConceptId) ?? []), prerequisite.requiredConceptId]);
    }
    const transitiveCount = (conceptId: string) => {
      const found = new Set<string>();
      const pending = [...(directPrerequisites.get(conceptId) ?? [])];
      while (pending.length) {
        const next = pending.pop()!;
        if (found.has(next)) continue;
        found.add(next);
        pending.push(...(directPrerequisites.get(next) ?? []));
      }
      return found.size;
    };
    return [...concepts].sort((left, right) =>
      transitiveCount(left.id) - transitiveCount(right.id)
      || (directPrerequisites.get(left.id)?.length ?? 0) - (directPrerequisites.get(right.id)?.length ?? 0)
      || left.title.localeCompare(right.title, locale)
    );
  }, [concepts, locale, prerequisites]);

  const visibleConcepts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? orderedConcepts.filter((concept) => `${concept.title} ${concept.skills}`.toLocaleLowerCase().includes(normalizedQuery))
      : orderedConcepts;
  }, [orderedConcepts, query]);
  const activeConcept = concepts.find((concept) => concept.id === activeConceptId) ?? visibleConcepts[0] ?? null;
  const generationRequest = useMemo<ActivityKnowledgeGenerationRequest>(() => {
    const catalog = concepts.map((concept) => ({ id: concept.id, title: concept.title, skills: conceptSkills(concept), skillIds: concept.skillRecords.map((skill) => skill.id) }));
    if (generationMode === "ignore") return { mode: "ignore", concepts: catalog };
    if (generationMode === "suggest") {
      return { mode: "suggest", concepts: catalog };
    }
    return {
      mode: "selected",
      concepts: catalog,
      selectedConcepts: draftSelections.flatMap((selection) => {
        const concept = concepts.find((candidate) => candidate.id === selection.conceptId);
        return concept ? [{
          id: concept.id,
          title: concept.title,
          skills: selection.selectsAllSkills ? conceptSkills(concept) : selection.selectedSkills,
          skillIds: selection.selectsAllSkills ? concept.skillRecords.map((skill) => skill.id) : (selection.selectedSkillIds ?? [])
        }] : [];
      })
    };
  }, [concepts, draftSelections, generationMode]);

  useEffect(() => {
    skillsPaneRef.current?.scrollTo({ top: 0 });
  }, [activeConcept?.id]);

  useEffect(() => { onConceptDraftChange?.(draftSelections); }, [draftSelections, onConceptDraftChange]);

  useEffect(() => {
    const nextKey = canonicalSelections(selectedConcepts);
    if (nextKey === selectedConceptsKeyRef.current) return;
    selectedConceptsKeyRef.current = nextKey;
    setSavedSelections(selectedConcepts);
    setDraftSelections(selectedConcepts);
  }, [selectedConcepts]);

  function selectionFor(conceptId: string) {
    return draftSelections.find((selection) => selection.conceptId === conceptId);
  }

  function setWholeConcept(concept: SubjectKnowledgeConcept, checked: boolean) {
    setDraftSelections((current) => checked
      ? [...current.filter((selection) => selection.conceptId !== concept.id), { conceptId: concept.id, selectsAllSkills: true, selectedSkills: conceptSkills(concept), selectedSkillIds: concept.skillRecords.map((skill) => skill.id) }]
      : current.filter((selection) => selection.conceptId !== concept.id));
  }

  function setSkill(concept: SubjectKnowledgeConcept, skill: string, checked: boolean) {
    const skills = conceptSkills(concept);
    setDraftSelections((current) => {
      const existing = current.find((selection) => selection.conceptId === concept.id);
      const selected = existing?.selectsAllSkills ? skills : (existing?.selectedSkills ?? []);
      const nextSkills = checked ? [...new Set([...selected, skill])] : selected.filter((candidate) => candidate !== skill);
      const nextSkillIds = concept.skillRecords.filter((candidate) => nextSkills.includes(candidate.title)).map((candidate) => candidate.id);
      const withoutConcept = current.filter((selection) => selection.conceptId !== concept.id);
      return nextSkills.length
        ? [...withoutConcept, { conceptId: concept.id, selectsAllSkills: false, selectedSkills: nextSkills, selectedSkillIds: nextSkillIds }]
        : withoutConcept;
    });
  }

  async function saveConceptsOnly() {
    setSaving(true);
    try {
      await onSaveConcepts(draftSelections);
      setSavedSelections(draftSelections);
      notifications.success(t("activityConcepts.saved"));
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : t("activityConcepts.saveError"));
      throw error;
    } finally {
      setSaving(false);
    }
  }

  const conceptGuardId = useUnsavedChangesGuard({ isDirty, onSave: saveConceptsOnly, onDiscard: () => setDraftSelections(savedSelections) });

  async function saveAll() {
    const activitySaveCount = await unsavedActions?.saveDirtyGuards([conceptGuardId]) ?? 0;
    if (!activitySaveCount) {
      await saveConceptsOnly();
      return;
    }
    setSavedSelections(draftSelections);
    notifications.success(t("activityConcepts.saved"));
  }

  return (
    <ActivityKnowledgeGenerationProvider value={{
      mode: generationMode,
      setMode: setGenerationMode,
      request: generationRequest,
      applySelections: (selections) => { if (selections) setDraftSelections(selections); }
    }}>
    <div className="stack">
      <div className="tab-strip" role="tablist" aria-label={t("activityConcepts.tabsLabel")}>
        <button type="button" role="tab" aria-selected={activeTab === "activity"} onClick={() => setActiveTab("activity")}>{t("activityConcepts.activityTab")}</button>
        <button type="button" role="tab" aria-selected={activeTab === "concepts"} onClick={() => setActiveTab("concepts")}>
          {t("activityConcepts.conceptsTab")}{savedSelections.length ? ` (${savedSelections.length})` : ""}
        </button>
      </div>

      <div role="tabpanel" hidden={activeTab !== "activity"}>{children}</div>
      <div role="tabpanel" hidden={activeTab !== "concepts"}>
        {(
          <section className="section stack">
            <div><h2>{t("activityConcepts.title")}</h2><p className="muted">{t("activityConcepts.description")}</p></div>
            {concepts.length ? (
              <>
                <div className="field">
                  <label htmlFor="activity-concept-search">{t("activityConcepts.search")}</label>
                  <input id="activity-concept-search" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <div className="activity-concept-selector">
                  <div className="activity-concept-list" role="list" aria-label={t("activityConcepts.conceptList")}>
                    {visibleConcepts.map((concept) => {
                      const selection = selectionFor(concept.id);
                      const selectedCount = selection?.selectsAllSkills ? conceptSkills(concept).length : selection?.selectedSkills.length ?? 0;
                      return (
                        <div className={`activity-concept-row${activeConcept?.id === concept.id ? " is-active" : ""}`} key={concept.id} role="listitem">
                          <ConceptCheckbox
                            checked={selection?.selectsAllSkills ?? false}
                            partial={Boolean(selection && !selection.selectsAllSkills)}
                            label={t("activityConcepts.selectWholeConcept", { title: concept.title })}
                            onChange={(checked) => setWholeConcept(concept, checked)}
                          />
                          <button type="button" onClick={() => setActiveConceptId(concept.id)}>
                            <span>{concept.title}</span>
                            {selectedCount ? <span className="activity-concept-count">{t("activityConcepts.skillsSelected", { count: selectedCount })}</span> : null}
                          </button>
                        </div>
                      );
                    })}
                    {!visibleConcepts.length ? <p className="muted">{t("activityConcepts.noMatches")}</p> : null}
                  </div>
                  <div className="activity-concept-skills" ref={skillsPaneRef}>
                    {activeConcept ? (
                      <>
                        <div><p className="eyebrow">{t("activityConcepts.skillsEyebrow")}</p><h3>{activeConcept.title}</h3></div>
                        {conceptSkills(activeConcept).length ? conceptSkills(activeConcept).map((skill) => {
                          const selection = selectionFor(activeConcept.id);
                          const checked = selection?.selectsAllSkills || selection?.selectedSkills.includes(skill) || false;
                          return <label className="activity-skill-row" key={skill}><input type="checkbox" checked={checked} onChange={(event) => setSkill(activeConcept, skill, event.target.checked)} /><span>{skill}</span></label>;
                        }) : <p className="muted">{t("activityConcepts.noSkills")}</p>}
                      </>
                    ) : <p className="muted">{t("activityConcepts.selectConceptHelp")}</p>}
                  </div>
                </div>
                <EditActionBar
                  isDirty={isDirty} isSaving={saving} onSave={() => void saveAll()} onCancel={() => setDraftSelections(savedSelections)}
                  savedLabel={getEditActionBarCopy(locale).saved} unsavedLabel={getEditActionBarCopy(locale).unsaved}
                  saveLabel={getEditActionBarCopy(locale).save} savingLabel={getEditActionBarCopy(locale).saving} cancelLabel={getEditActionBarCopy(locale).cancel}
                />
              </>
            ) : <p className="muted">{t("activityConcepts.empty")}</p>}
          </section>
        )}
      </div>
    </div>
    </ActivityKnowledgeGenerationProvider>
  );
}
