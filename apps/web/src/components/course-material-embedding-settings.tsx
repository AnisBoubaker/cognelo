"use client";
import { HelpLabel } from "@cognelo/activity-ui";

import { useCallback, useEffect, useState } from "react";
import type { AiModelSelection, CourseMaterialEmbeddingSettingsView } from "@cognelo/contracts";
import { AiModelPicker, EditActionBar, getEditActionBarCopy, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { materialReferenceCopy } from "@/lib/material-reference-copy";
export function CourseMaterialEmbeddingSettings({ courseId }: { courseId: string }) {
  const { locale } = useI18n(), copy = materialReferenceCopy(locale), action = getEditActionBarCopy(locale), notifications = useNotifications();
  const [value, setValue] = useState<CourseMaterialEmbeddingSettingsView | null>(null), [selection, setSelection] = useState<AiModelSelection | null>(null), [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(""), [retry, setRetry] = useState(0);
  const path = `/courses/${courseId}/material-embedding-settings`;
  const dirty = Boolean(value && JSON.stringify(selection) !== JSON.stringify(value.selection));
  useEffect(() => { setLoadError(""); const controller = new AbortController(); void apiRequest<CourseMaterialEmbeddingSettingsView>(path, { signal: controller.signal }).then(result => { setValue(result); setSelection(result.selection); }).catch(error => { if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : copy.error; setLoadError(message); notifications.error(message); } }); return () => controller.abort(); }, [path, notifications, copy.error, retry]);
  const save = useCallback(async () => {
    setSaving(true);
    try { const result = await apiRequest<CourseMaterialEmbeddingSettingsView>(path, { method: "PUT", body: JSON.stringify({ selection }) }); setValue(result); setSelection(result.selection); notifications.success(copy.modelSaved); }
    catch (error) { notifications.error(error instanceof Error ? error.message : copy.error); throw error; }
    finally { setSaving(false); }
  }, [path, selection, notifications, copy.modelSaved, copy.error]);
  const discard = () => setSelection(value?.selection ?? null);
  useUnsavedChangesGuard({ isDirty: dirty, onDiscard: discard, onSave: save });
  return <section className="section stack" id="material-embeddings"><HelpLabel help={<>{copy.modelHelp}</>}><h3>{copy.model}</h3></HelpLabel>
    {!value ? <><p role="status">{loadError || copy.loading}</p>{loadError && <button type="button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button>}</> : <>
      <AiModelPicker connections={value.connections} purpose="embedding" value={selection} onChange={setSelection} disabled={saving}
        labels={{ connection: copy.connection, model: copy.modelLabel, inherit: copy.inherited, unavailable: copy.unavailable, noModels: copy.noModels }} />
      {!dirty && value.resolved && <p className="muted">{copy.inUse}: {value.resolved.model}</p>}
      {!dirty && value.error && <p role="status">{value.error}</p>}
      <EditActionBar isDirty={dirty} isSaving={saving} savedLabel={action.saved} unsavedLabel={action.unsaved} saveLabel={action.save} savingLabel={action.saving} cancelLabel={action.cancel} onCancel={discard} onSave={() => void save().catch(() => {})} />
    </>}
  </section>;
}
