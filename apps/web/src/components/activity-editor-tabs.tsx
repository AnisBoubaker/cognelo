"use client";

import { EditActionBar, getEditActionBarCopy, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { useMemo, useState } from "react";
import type { SubjectKnowledgeConcept } from "@/lib/api";

type ActivityEditorTabsProps = {
  children: React.ReactNode;
  concepts: SubjectKnowledgeConcept[];
  selectedConceptIds: string[];
  onSaveConcepts: (conceptIds: string[]) => Promise<void>;
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
};

export function ActivityEditorTabs({ children, concepts, selectedConceptIds, onSaveConcepts, t, locale }: ActivityEditorTabsProps) {
  const notifications = useNotifications();
  const [activeTab, setActiveTab] = useState<"activity" | "concepts">("activity");
  const [draftIds, setDraftIds] = useState(selectedConceptIds);
  const [savedIds, setSavedIds] = useState(selectedConceptIds);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const isDirty = [...draftIds].sort().join("|") !== [...savedIds].sort().join("|");
  const visibleConcepts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? concepts.filter((concept) => `${concept.title} ${concept.skills}`.toLocaleLowerCase().includes(normalizedQuery))
      : concepts;
  }, [concepts, query]);

  async function save() {
    setSaving(true);
    try {
      await onSaveConcepts(draftIds);
      setSavedIds(draftIds);
      notifications.success(t("activityConcepts.saved"));
    } catch (error) {
      notifications.error(error instanceof Error ? error.message : t("activityConcepts.saveError"));
      throw error;
    } finally {
      setSaving(false);
    }
  }

  useUnsavedChangesGuard({
    isDirty,
    onSave: save,
    onDiscard: () => setDraftIds(savedIds)
  });

  return (
    <div className="stack">
      <div className="tab-strip" role="tablist" aria-label={t("activityConcepts.tabsLabel")}>
        <button type="button" role="tab" aria-selected={activeTab === "activity"} onClick={() => setActiveTab("activity")}>
          {t("activityConcepts.activityTab")}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "concepts"} onClick={() => setActiveTab("concepts")}>
          {t("activityConcepts.conceptsTab")}
          {savedIds.length ? ` (${savedIds.length})` : ""}
        </button>
      </div>

      <div role="tabpanel" hidden={activeTab !== "activity"}>{activeTab === "activity" ? children : null}</div>
      <div role="tabpanel" hidden={activeTab !== "concepts"}>
        {activeTab === "concepts" ? (
          <section className="section stack">
            <div>
              <h2>{t("activityConcepts.title")}</h2>
              <p className="muted">{t("activityConcepts.description")}</p>
            </div>
            {concepts.length ? (
              <>
                <div className="field">
                  <label htmlFor="activity-concept-search">{t("activityConcepts.search")}</label>
                  <input id="activity-concept-search" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {visibleConcepts.map((concept) => (
                    <label className="panel" key={concept.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={draftIds.includes(concept.id)}
                        onChange={(event) => setDraftIds((current) => event.target.checked ? [...current, concept.id] : current.filter((id) => id !== concept.id))}
                      />
                      <span>
                        <strong>{concept.title}</strong>
                        {concept.skills ? (
                          <ul className="muted" style={{ margin: "6px 0 0", paddingInlineStart: 20 }}>
                            {concept.skills.split(/\r?\n/).filter((skill) => skill.trim()).map((skill, index) => <li key={`${concept.id}-skill-${index}`}>{skill.trim()}</li>)}
                          </ul>
                        ) : null}
                      </span>
                    </label>
                  ))}
                  {!visibleConcepts.length ? <p className="muted">{t("activityConcepts.noMatches")}</p> : null}
                </div>
                <EditActionBar
                  isDirty={isDirty}
                  isSaving={saving}
                  onSave={() => void save()}
                  onCancel={() => setDraftIds(savedIds)}
                  savedLabel={getEditActionBarCopy(locale).saved}
                  unsavedLabel={getEditActionBarCopy(locale).unsaved}
                  saveLabel={getEditActionBarCopy(locale).save}
                  savingLabel={getEditActionBarCopy(locale).saving}
                  cancelLabel={getEditActionBarCopy(locale).cancel}
                />
              </>
            ) : <p className="muted">{t("activityConcepts.empty")}</p>}
          </section>
        ) : null}
      </div>
    </div>
  );
}
