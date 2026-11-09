"use client";
import { HelpLabel } from "@cognelo/activity-ui";

import { ActivityReferenceAuthoringProvider, type ActivityReferenceAuthoringState, ActivityKnowledgeGenerationProvider, EditActionBar, getEditActionBarCopy, useNotifications, useUnsavedChangesActions, useUnsavedChangesGuard, type ActivityKnowledgeGenerationMode, type ActivityKnowledgeGenerationRequest } from "@cognelo/activity-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityKnowledgeConceptSelection } from "@cognelo/contracts";
import { ActivityMaterialReferences } from "./activity-material-references";
import type { SubjectKnowledgeConcept, SubjectKnowledgePrerequisite } from "@/lib/api";

type ActivityEditorTabsProps = {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  concepts: SubjectKnowledgeConcept[];
  prerequisites: SubjectKnowledgePrerequisite[];
  selectedConcepts: ActivityKnowledgeConceptSelection[];
  onSaveConcepts: (selections: ActivityKnowledgeConceptSelection[]) => Promise<void>;
  onConceptDraftChange?: (selections: ActivityKnowledgeConceptSelection[]) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  showGradingTab?: boolean;
  showReferenceMaterialsTab?: boolean;
  showSettingsTab?: boolean;
  showSimulationTab?: boolean;
  materialReferences?: { courseId: string; activityId: string };
};

const ActivityEditorSimulationPortalContext = createContext<HTMLElement | null | undefined>(undefined);
export function useActivityEditorSimulationPortalTarget() { return useContext(ActivityEditorSimulationPortalContext); }

const ActivityEditorSettingsPortalContext = createContext<HTMLElement | null | undefined>(undefined);
export function useActivityEditorSettingsPortalTarget() { return useContext(ActivityEditorSettingsPortalContext); }

const ActivityEditorReferenceMaterialsPortalContext = createContext<HTMLElement | null | undefined>(undefined);
export function useActivityEditorReferenceMaterialsPortalTarget() { return useContext(ActivityEditorReferenceMaterialsPortalContext); }

const ActivityEditorGradingPortalContext = createContext<HTMLElement | null | undefined>(undefined);

export function useActivityEditorGradingPortalTarget() {
  return useContext(ActivityEditorGradingPortalContext);
}

function conceptSkills(concept: SubjectKnowledgeConcept) {
  return concept.skillRecords?.length ? concept.skillRecords.map((skill) => skill.title) : concept.skills.split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean);
}

function conceptMisconceptions(concept: SubjectKnowledgeConcept) {
  return concept.misconceptionRecords?.length ? concept.misconceptionRecords.map((item) => item.title) : (concept.misconceptions ?? []);
}

function selectedSkillTitles(concept: SubjectKnowledgeConcept, selection: ActivityKnowledgeConceptSelection | undefined) {
  if (selection?.selectsAllSkills) return conceptSkills(concept);
  const ids = new Set(selection?.selectedSkillIds ?? []);
  const titles = new Set(selection?.selectedSkills ?? []);
  return conceptSkills(concept).filter((title) => {
    const record = concept.skillRecords.find((item) => item.title === title);
    return titles.has(title) || Boolean(record && ids.has(record.id));
  });
}

function selectedMisconceptionTitles(concept: SubjectKnowledgeConcept, selection: ActivityKnowledgeConceptSelection | undefined) {
  if (selection?.selectsAllSkills) return conceptMisconceptions(concept);
  const ids = new Set(selection?.selectedMisconceptionIds ?? []);
  const titles = new Set(selection?.selectedMisconceptions ?? []);
  return conceptMisconceptions(concept).filter((title) => {
    const record = concept.misconceptionRecords.find((item) => item.title === title);
    return titles.has(title) || Boolean(record && ids.has(record.id));
  });
}

function canonicalSelections(selections: ActivityKnowledgeConceptSelection[]) {
  return JSON.stringify(selections
    .map((selection) => ({
      ...selection,
      selectedSkills: [...selection.selectedSkills].sort(),
      selectedSkillIds: [...(selection.selectedSkillIds ?? [])].sort(),
      selectedMisconceptions: [...(selection.selectedMisconceptions ?? [])].sort(),
      selectedMisconceptionIds: [...(selection.selectedMisconceptionIds ?? [])].sort()
    }))
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId)));
}

function ConceptCheckbox({ checked, partial, label, onChange }: { checked: boolean; partial: boolean; label: string; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = partial; }, [partial]);
  return <input ref={ref} type="checkbox" checked={checked} aria-label={label} onChange={(event) => onChange(event.target.checked)} />;
}

export function ActivityEditorTabs({ children, toolbar, concepts, prerequisites, selectedConcepts, onSaveConcepts, onConceptDraftChange, t, locale, showGradingTab = false, showReferenceMaterialsTab = false, showSettingsTab = false, showSimulationTab = false, materialReferences }: ActivityEditorTabsProps) {
  const notifications = useNotifications();
  const unsavedActions = useUnsavedChangesActions();
  const [activeTab, setActiveTab] = useState<"activity" | "concepts" | "grading" | "references" | "settings" | "simulation">("activity");
  const [simulationPortalTarget, setSimulationPortalTarget] = useState<HTMLDivElement | null>(null);
  const [referenceState, setReferenceState] = useState<ActivityReferenceAuthoringState>({ loaded: false, dirty: false, prepared: false, revision: "" });
  const simulationPortalRef = useCallback((node: HTMLDivElement | null) => setSimulationPortalTarget(current => current === node ? current : node), []);
  const [settingsPortalTarget, setSettingsPortalTarget] = useState<HTMLDivElement | null>(null);
  const [referenceMaterialsPortalTarget, setReferenceMaterialsPortalTarget] = useState<HTMLDivElement | null>(null);
  const [gradingPortalTarget, setGradingPortalTarget] = useState<HTMLDivElement | null>(null);
  const [draftSelections, setDraftSelections] = useState(selectedConcepts);
  const [savedSelections, setSavedSelections] = useState(selectedConcepts);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [generationMode, setGenerationMode] = useState<ActivityKnowledgeGenerationMode>("selected");
  const skillsPaneRef = useRef<HTMLDivElement | null>(null);
  const selectedConceptsKeyRef = useRef(canonicalSelections(selectedConcepts));
  const isDirty = canonicalSelections(draftSelections) !== canonicalSelections(savedSelections);
  const settingsPortalRef = useCallback((node: HTMLDivElement | null) => setSettingsPortalTarget(current => current === node ? current : node), []);
  const referenceMaterialsPortalRef = useCallback((node: HTMLDivElement | null) => setReferenceMaterialsPortalTarget(current => current === node ? current : node), []);
  const gradingPortalRef = useCallback((node: HTMLDivElement | null) => {
    setGradingPortalTarget((current) => current === node ? current : node);
  }, []);

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
      ? orderedConcepts.filter((concept) => `${concept.title} ${concept.skills} ${conceptMisconceptions(concept).join(" ")}`.toLocaleLowerCase().includes(normalizedQuery))
      : orderedConcepts;
  }, [orderedConcepts, query]);
  const activeConcept = concepts.find((concept) => concept.id === activeConceptId) ?? visibleConcepts[0] ?? null;
  const generationRequest = useMemo<ActivityKnowledgeGenerationRequest>(() => {
    const catalog = concepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
      skills: conceptSkills(concept),
      skillIds: concept.skillRecords.map((skill) => skill.id),
      misconceptions: conceptMisconceptions(concept),
      misconceptionIds: concept.misconceptionRecords.map((item) => item.id)
    }));
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
          skills: selectedSkillTitles(concept, selection),
          skillIds: selection.selectsAllSkills ? concept.skillRecords.map((skill) => skill.id) : (selection.selectedSkillIds ?? []),
          misconceptions: selectedMisconceptionTitles(concept, selection),
          misconceptionIds: selection.selectsAllSkills ? concept.misconceptionRecords.map((item) => item.id) : (selection.selectedMisconceptionIds ?? [])
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
      ? [...current.filter((selection) => selection.conceptId !== concept.id), {
          conceptId: concept.id,
          selectsAllSkills: true,
          selectedSkills: conceptSkills(concept),
          selectedSkillIds: concept.skillRecords.map((skill) => skill.id),
          selectedMisconceptions: conceptMisconceptions(concept),
          selectedMisconceptionIds: concept.misconceptionRecords.map((item) => item.id)
        }]
      : current.filter((selection) => selection.conceptId !== concept.id));
  }

  function setSkill(concept: SubjectKnowledgeConcept, skill: string, checked: boolean) {
    const skills = conceptSkills(concept);
    setDraftSelections((current) => {
      const existing = current.find((selection) => selection.conceptId === concept.id);
      const selected = selectedSkillTitles(concept, existing);
      const nextSkills = checked ? [...new Set([...selected, skill])] : selected.filter((candidate) => candidate !== skill);
      const nextSkillIds = concept.skillRecords.filter((candidate) => nextSkills.includes(candidate.title)).map((candidate) => candidate.id);
      const selectedMisconceptions = selectedMisconceptionTitles(concept, existing);
      const selectedMisconceptionIds = concept.misconceptionRecords.filter((candidate) => selectedMisconceptions.includes(candidate.title)).map((candidate) => candidate.id);
      const withoutConcept = current.filter((selection) => selection.conceptId !== concept.id);
      return nextSkills.length || selectedMisconceptions.length
        ? [...withoutConcept, { conceptId: concept.id, selectsAllSkills: false, selectedSkills: nextSkills, selectedSkillIds: nextSkillIds, selectedMisconceptions, selectedMisconceptionIds }]
        : withoutConcept;
    });
  }

  function setMisconception(concept: SubjectKnowledgeConcept, misconception: string, checked: boolean) {
    const misconceptions = conceptMisconceptions(concept);
    setDraftSelections((current) => {
      const existing = current.find((selection) => selection.conceptId === concept.id);
      const selected = selectedMisconceptionTitles(concept, existing);
      const nextMisconceptions = checked ? [...new Set([...selected, misconception])] : selected.filter((candidate) => candidate !== misconception);
      const nextMisconceptionIds = concept.misconceptionRecords.filter((candidate) => nextMisconceptions.includes(candidate.title)).map((candidate) => candidate.id);
      const selectedSkills = selectedSkillTitles(concept, existing);
      const selectedSkillIds = concept.skillRecords.filter((candidate) => selectedSkills.includes(candidate.title)).map((candidate) => candidate.id);
      const withoutConcept = current.filter((selection) => selection.conceptId !== concept.id);
      return selectedSkills.length || nextMisconceptions.length
        ? [...withoutConcept, { conceptId: concept.id, selectsAllSkills: false, selectedSkills, selectedSkillIds, selectedMisconceptions: nextMisconceptions, selectedMisconceptionIds: nextMisconceptionIds }]
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
    <ActivityReferenceAuthoringProvider value={materialReferences ? referenceState : null}>
    <ActivityEditorSimulationPortalContext.Provider value={showSimulationTab ? simulationPortalTarget : undefined}>
    <ActivityEditorSettingsPortalContext.Provider value={showSettingsTab ? settingsPortalTarget : undefined}>
    <ActivityEditorReferenceMaterialsPortalContext.Provider value={showReferenceMaterialsTab && !materialReferences ? referenceMaterialsPortalTarget : undefined}>
    <ActivityEditorGradingPortalContext.Provider value={showGradingTab ? gradingPortalTarget : undefined}>
    <ActivityKnowledgeGenerationProvider value={{
      mode: generationMode,
      setMode: setGenerationMode,
      request: generationRequest,
      applySelections: (selections) => { if (selections) setDraftSelections(selections); }
    }}>
    <div className="stack">
      <div className="workspace-tab-toolbar">
        <div className="tab-strip" role="tablist" aria-label={t("activityConcepts.tabsLabel")}>
          <button type="button" role="tab" aria-selected={activeTab === "activity"} onClick={() => setActiveTab("activity")}>{t("activityConcepts.activityTab")}</button>
          <button type="button" role="tab" aria-selected={activeTab === "concepts"} onClick={() => setActiveTab("concepts")}>
            {t("activityConcepts.conceptsTab")}{savedSelections.length ? ` (${savedSelections.length})` : ""}
          </button>
          {showReferenceMaterialsTab ? (
            <button id="activity-editor-references-tab" type="button" role="tab" aria-selected={activeTab === "references"} aria-controls="activity-editor-references-panel" onClick={() => setActiveTab("references")}>
              {t("activityConcepts.referenceMaterialsTab")}
            </button>
          ) : null}
          {showSettingsTab ? (
            <button id="activity-editor-settings-tab" type="button" role="tab" aria-selected={activeTab === "settings"} aria-controls="activity-editor-settings-panel" onClick={() => setActiveTab("settings")}>
              {t("activityConcepts.settingsTab")}
            </button>
          ) : null}
          {showSimulationTab ? <button id="activity-editor-simulation-tab" type="button" role="tab" aria-selected={activeTab === "simulation"} aria-controls="activity-editor-simulation-panel" onClick={() => setActiveTab("simulation")}>{t("activityConcepts.simulationTab")}</button> : null}
          {showGradingTab ? (
            <button type="button" role="tab" aria-selected={activeTab === "grading"} onClick={() => setActiveTab("grading")}>
              {t("activityConcepts.gradingTab")}
            </button>
          ) : null}
        </div>
        {toolbar ? <div className="workspace-tab-trailing">{toolbar}</div> : null}
      </div>

      <div role="tabpanel" hidden={activeTab !== "activity"}>{children}</div>
      <div role="tabpanel" hidden={activeTab !== "concepts"}>
        {(
          <section className="section stack">
            <div><HelpLabel help={<>{t("activityConcepts.description")}</>}><h2>{t("activityConcepts.title")}</h2></HelpLabel></div>
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
                      const selectedCount = selectedSkillTitles(concept, selection).length + selectedMisconceptionTitles(concept, selection).length;
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
                            {selectedCount ? <span className="activity-concept-count">{t("activityConcepts.targetsSelected", { count: selectedCount })}</span> : null}
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
                          const checked = selectedSkillTitles(activeConcept, selection).includes(skill);
                          return <label className="activity-skill-row" key={skill}><input type="checkbox" checked={checked} onChange={(event) => setSkill(activeConcept, skill, event.target.checked)} /><span>{skill}</span></label>;
                        }) : <p className="muted">{t("activityConcepts.noSkills")}</p>}
                        <div><p className="eyebrow">{t("activityConcepts.misconceptionsEyebrow")}</p></div>
                        {conceptMisconceptions(activeConcept).length ? conceptMisconceptions(activeConcept).map((misconception) => {
                          const selection = selectionFor(activeConcept.id);
                          const checked = selectedMisconceptionTitles(activeConcept, selection).includes(misconception);
                          return <label className="activity-skill-row" key={misconception}><input type="checkbox" checked={checked} onChange={(event) => setMisconception(activeConcept, misconception, event.target.checked)} /><span>{misconception}</span></label>;
                        }) : <p className="muted">{t("activityConcepts.noMisconceptions")}</p>}
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
      {showReferenceMaterialsTab ? <div id="activity-editor-references-panel" role="tabpanel" aria-labelledby="activity-editor-references-tab" hidden={activeTab !== "references"} ref={referenceMaterialsPortalRef}>{materialReferences && <ActivityMaterialReferences active={activeTab === "references"} key={materialReferences.activityId} {...materialReferences} locale={locale} onStateChange={setReferenceState} />}</div> : null}
      {showSimulationTab ? <div id="activity-editor-simulation-panel" role="tabpanel" aria-labelledby="activity-editor-simulation-tab" hidden={activeTab !== "simulation"} ref={simulationPortalRef} /> : null}
      {showSettingsTab ? <div id="activity-editor-settings-panel" role="tabpanel" aria-labelledby="activity-editor-settings-tab" hidden={activeTab !== "settings"} ref={settingsPortalRef} /> : null}
      {showGradingTab ? <div role="tabpanel" hidden={activeTab !== "grading"} ref={gradingPortalRef} /> : null}
    </div>
    </ActivityKnowledgeGenerationProvider>
    </ActivityEditorGradingPortalContext.Provider>
    </ActivityEditorReferenceMaterialsPortalContext.Provider>
    </ActivityEditorSettingsPortalContext.Provider>
    </ActivityEditorSimulationPortalContext.Provider>
    </ActivityReferenceAuthoringProvider>
  );
}
