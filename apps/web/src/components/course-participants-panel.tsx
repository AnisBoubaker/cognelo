"use client";

import { ConfirmationDialog } from "@cognelo/activity-ui";
import { FocusEvent, FormEvent, useEffect, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import {
  api,
  type CourseGroup,
  type GroupParticipant,
  type GroupParticipantCandidate
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type GroupEditor = {
  groupId: string | null;
  title: string;
  status: "draft" | "published";
  availableFrom: string;
  availableUntil: string;
};

type GroupDeleteState = {
  group: CourseGroup;
  participants: GroupParticipant[];
  step: "options" | "confirm-empty" | "confirm-permanent";
  mode: "move" | "delete";
  targetGroupId: string;
};

type ParticipantEditor = {
  group: CourseGroup;
  firstName: string;
  lastName: string;
  email: string;
  externalId: string;
  role: "teacher" | "ta" | "student";
  candidate: GroupParticipantCandidate | null;
};

export function CourseParticipantsPanel({
  courseId,
  currentUserId,
  groups,
  onChanged
}: {
  courseId: string;
  currentUserId?: string;
  groups: CourseGroup[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [groupDetails, setGroupDetails] = useState<Record<string, CourseGroup>>({});
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [editor, setEditor] = useState<GroupEditor | null>(null);
  const [participantEditor, setParticipantEditor] = useState<ParticipantEditor | null>(null);
  const [deleteState, setDeleteState] = useState<GroupDeleteState | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadGroupDetails(nextGroups = groups) {
    if (!nextGroups.length) {
      setGroupDetails({});
      return;
    }
    setLoadingGroups(true);
    try {
      const results = await Promise.all(nextGroups.map((group) => api.group(courseId, group.id)));
      setGroupDetails(Object.fromEntries(results.map(({ group }) => [group.id, group])));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("groupPage.loadError"));
    } finally {
      setLoadingGroups(false);
    }
  }

  useEffect(() => {
    void loadGroupDetails(groups);
  }, [courseId, groups.map((group) => `${group.id}:${group.status}:${group.title}`).join("|")]);

  function openCreateGroup() {
    setError("");
    setEditor({ groupId: null, title: "", status: "draft", availableFrom: "", availableUntil: "" });
  }

  function openEditGroup(group: CourseGroup) {
    const detail = groupDetails[group.id] ?? group;
    setError("");
    setEditor({
      groupId: group.id,
      title: detail.title,
      status: detail.status,
      availableFrom: toDateTimeLocalValue(detail.availableFrom),
      availableUntil: toDateTimeLocalValue(detail.availableUntil)
    });
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      if (editor.groupId) {
        await api.updateGroup(courseId, editor.groupId, {
          title: editor.title,
          status: editor.status,
          availableFrom: toIsoOrNull(editor.availableFrom),
          availableUntil: toIsoOrNull(editor.availableUntil)
        });
      } else {
        await api.createGroup(courseId, { title: editor.title });
      }
      setEditor(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(editor.groupId ? "groupPage.groupSaveError" : "courseDetail.createGroupError"));
    } finally {
      setSaving(false);
    }
  }

  function openParticipantEditor(group: CourseGroup) {
    setError("");
    setParticipantEditor({ group, role: "student", firstName: "", lastName: "", email: "", externalId: "", candidate: null });
  }

  async function resolveParticipantEmail(event?: FocusEvent<HTMLInputElement>) {
    if (!participantEditor) return;
    const email = (event?.target.value ?? participantEditor.email).trim().toLowerCase();
    if (!email) {
      setParticipantEditor({ ...participantEditor, candidate: null, firstName: "", lastName: "" });
      return;
    }
    setCheckingEmail(true);
    setError("");
    try {
      const result = await api.groupParticipantCandidate(courseId, email);
      setParticipantEditor((current) => current ? {
        ...current,
        email,
        candidate: result.candidate,
        firstName: result.candidate?.firstName ?? "",
        lastName: result.candidate?.lastName ?? ""
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("groupPage.participantLookupError"));
    } finally {
      setCheckingEmail(false);
    }
  }

  async function addParticipant(event: FormEvent) {
    event.preventDefault();
    if (!participantEditor) return;
    setSaving(true);
    setError("");
    try {
      await api.addGroupParticipant(courseId, participantEditor.group.id, {
        role: participantEditor.role,
        firstName: participantEditor.candidate ? undefined : participantEditor.firstName,
        lastName: participantEditor.candidate ? undefined : participantEditor.lastName,
        email: participantEditor.email,
        externalId: participantEditor.externalId || null
      });
      setParticipantEditor(null);
      await loadGroupDetails();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("groupPage.participantCreateError"));
    } finally {
      setSaving(false);
    }
  }

  async function removeParticipant(group: CourseGroup, participant: GroupParticipant) {
    if (!window.confirm(t("groupPage.removeParticipantConfirm", { name: `${participant.firstName} ${participant.lastName}`.trim() }))) return;
    setRemovingParticipantId(participant.id);
    setError("");
    try {
      await api.removeGroupParticipant(courseId, group.id, participant.id);
      await loadGroupDetails();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("groupPage.participantDeleteError"));
    } finally {
      setRemovingParticipantId(null);
    }
  }

  async function openGroupDelete(group: CourseGroup) {
    setError("");
    try {
      const detail = groupDetails[group.id] ?? (await api.group(courseId, group.id)).group;
      const participants = detail.participants ?? [];
      const hasLearners = participants.some((participant) => participant.role === "student");
      setDeleteState({ group: detail, participants, step: hasLearners ? "options" : "confirm-empty", mode: "move", targetGroupId: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.deleteGroupError"));
    }
  }

  async function deleteGroup(input: { action: "move"; targetGroupId: string } | { action: "delete"; confirmParticipantDeletion?: boolean }) {
    if (!deleteState) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteGroup(courseId, deleteState.group.id, input);
      setDeleteState(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("courseDetail.deleteGroupError"));
    } finally {
      setSaving(false);
    }
  }

  function submitDeleteOptions(event: FormEvent) {
    event.preventDefault();
    if (!deleteState) return;
    if (deleteState.mode === "delete") {
      setDeleteState({ ...deleteState, step: "confirm-permanent" });
      return;
    }
    void deleteGroup({ action: "move", targetGroupId: deleteState.targetGroupId });
  }

  return (
    <section className="section stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("courseDetail.participantsEyebrow")}</p>
          <h2>{t("courseDetail.participantsTitle")}</h2>
          <p className="muted">{t("courseDetail.participantsText")}</p>
        </div>
        <button className="secondary" type="button" onClick={openCreateGroup}>
          <AppIcon name="add" />
          <span>{t("courseDetail.createGroup")}</span>
        </button>
      </div>

      {groups.length ? (
        <div className="participant-group-list">
          {groups.map((group) => {
            const detail = groupDetails[group.id] ?? group;
            const participants = detail.participants ?? [];
            return (
              <section className="participant-group-card stack" key={group.id}>
                <div className="participant-group-heading">
                  <div>
                    <div className="participant-group-title-row">
                      <h3>{detail.title}</h3>
                      <span className={`participant-status ${detail.status === "published" ? "is-linked" : "is-pending"}`}>
                        {detail.status === "published" ? t("groupPage.statusPublished") : t("groupPage.statusDraft")}
                      </span>
                    </div>
                    <p className="muted">
                      {t("courseDetail.participantCount", { count: participants.length })} · {formatAvailabilityWindow(detail.availableFrom, detail.availableUntil, t)}
                    </p>
                  </div>
                  <div className="row participant-group-actions">
                    <button className="secondary" type="button" onClick={() => openParticipantEditor(detail)}>
                      <AppIcon name="add" />
                      <span>{t("groupPage.addParticipant")}</span>
                    </button>
                    <button className="secondary icon-button" type="button" title={t("courseDetail.editGroup")} onClick={() => openEditGroup(detail)}>
                      <AppIcon name="edit" />
                    </button>
                    <button className="danger icon-button" disabled={groups.length <= 1} type="button" title={groups.length <= 1 ? t("courseDetail.deleteLastGroupHelp") : t("courseDetail.deleteGroupAction")} onClick={() => void openGroupDelete(detail)}>
                      <AppIcon name="remove" />
                    </button>
                  </div>
                </div>

                {participants.length ? (
                  <div className="table-list">
                    <div className="table-row table-row-participants table-head" aria-hidden="true">
                      <span>{t("groupPage.participantNameHeader")}</span>
                      <span>{t("groupPage.participantRoleHeader")}</span>
                      <span>{t("groupPage.participantEmailHeader")}</span>
                      <span>{t("groupPage.participantExternalIdHeader")}</span>
                      <span>{t("groupPage.participantStatusHeader")}</span>
                      <span>{t("courseDetail.actionsHeader")}</span>
                    </div>
                    {participants.map((participant) => (
                      <div className="table-row table-row-participants" key={participant.id}>
                        <strong>{participant.firstName} {participant.lastName}</strong>
                        <span className={`participant-role participant-role-${participant.role}`}>{t(`groupPage.participantRole${capitalize(participant.role)}`)}</span>
                        <span className="table-meta">{participant.email}</span>
                        <span className="table-meta">{participant.externalId || t("groupPage.noExternalId")}</span>
                        <span className={`participant-status ${participant.userId ? "is-linked" : "is-pending"}`}>
                          {participant.userId ? t("groupPage.participantStatusLinked") : t("groupPage.participantStatusPending")}
                        </span>
                        <div className="table-actions">
                          <button aria-label={t("groupPage.removeParticipant")} className="danger icon-button" disabled={removingParticipantId === participant.id || participant.userId === currentUserId} title={participant.userId === currentUserId ? t("groupPage.removeSelfBlocked") : t("groupPage.removeParticipant")} type="button" onClick={() => void removeParticipant(detail, participant)}>
                            <AppIcon name="remove" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : loadingGroups ? <p className="muted">{t("common.loading")}</p> : <p className="muted">{t("groupPage.noParticipants")}</p>}
              </section>
            );
          })}
        </div>
      ) : <p className="muted">{t("courseDetail.noGroups")}</p>}
      {error && !editor && !participantEditor && !deleteState ? <p className="error" role="alert">{error}</p> : null}

      {editor ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="group-editor-title" aria-modal="true" className="dialog-panel" role="dialog">
            <div className="section-heading">
              <div><p className="eyebrow">{t("courseDetail.groupShellEyebrow")}</p><h2 id="group-editor-title">{t(editor.groupId ? "courseDetail.editGroup" : "courseDetail.groupShellTitle")}</h2></div>
              <button className="secondary icon-button" type="button" title={t("common.close")} onClick={() => setEditor(null)}><AppIcon name="close" /></button>
            </div>
            <form className="form" onSubmit={saveGroup}>
              <div className="field"><label htmlFor="participant-group-title">{t("courseDetail.groupTitle")}</label><input id="participant-group-title" minLength={2} required value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></div>
              {editor.groupId ? <>
                <div className="field"><label htmlFor="participant-group-status">{t("groupPage.statusLabel")}</label><select id="participant-group-status" value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as GroupEditor["status"] })}><option value="draft">{t("groupPage.statusDraft")}</option><option value="published">{t("groupPage.statusPublished")}</option></select></div>
                <div className="form-grid-two"><div className="field"><label htmlFor="participant-group-from">{t("groupPage.availableFrom")}</label><DateTimeMinuteInput id="participant-group-from" value={editor.availableFrom} onChange={(value) => setEditor({ ...editor, availableFrom: value })} /></div><div className="field"><label htmlFor="participant-group-until">{t("groupPage.availableUntil")}</label><DateTimeMinuteInput id="participant-group-until" value={editor.availableUntil} onChange={(value) => setEditor({ ...editor, availableUntil: value })} /></div></div>
              </> : null}
              {error ? <p className="error" role="alert">{error}</p> : null}
              <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setEditor(null)}>{t("common.cancel")}</button><button disabled={saving} type="submit">{saving ? t("common.saving") : t("common.save")}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {participantEditor ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="participant-editor-title" aria-modal="true" className="dialog-panel participant-editor-dialog" role="dialog">
            <div className="section-heading"><div><p className="eyebrow">{participantEditor.group.title}</p><h2 id="participant-editor-title">{t("groupPage.addParticipantTitle")}</h2><p className="muted">{t("groupPage.addParticipantText")}</p></div><button className="secondary icon-button" type="button" title={t("common.close")} onClick={() => setParticipantEditor(null)}><AppIcon name="close" /></button></div>
            <form className="form" onSubmit={addParticipant}>
              <div className="form-grid-two"><div className="field"><label htmlFor="participant-email">{t("groupPage.participantEmail")}</label><input id="participant-email" required type="email" value={participantEditor.email} onBlur={(event) => void resolveParticipantEmail(event)} onChange={(event) => setParticipantEditor({ ...participantEditor, email: event.target.value, candidate: null, firstName: "", lastName: "" })} /></div><div className="field"><label htmlFor="participant-role">{t("groupPage.participantRole")}</label><select id="participant-role" value={participantEditor.role} onChange={(event) => setParticipantEditor({ ...participantEditor, role: event.target.value as ParticipantEditor["role"] })}><option value="student">{t("groupPage.participantRoleStudent")}</option><option value="ta">{t("groupPage.participantRoleTa")}</option><option value="teacher">{t("groupPage.participantRoleTeacher")}</option></select></div></div>
              <div className="form-grid-two"><div className={`field ${participantEditor.candidate ? "field-readonly" : ""}`}><label htmlFor="participant-first-name">{t("groupPage.participantFirstName")}</label><input id="participant-first-name" readOnly={Boolean(participantEditor.candidate)} required={!participantEditor.candidate} value={participantEditor.firstName} onChange={(event) => setParticipantEditor({ ...participantEditor, firstName: event.target.value })} /></div><div className={`field ${participantEditor.candidate ? "field-readonly" : ""}`}><label htmlFor="participant-last-name">{t("groupPage.participantLastName")}</label><input id="participant-last-name" readOnly={Boolean(participantEditor.candidate)} required={!participantEditor.candidate} value={participantEditor.lastName} onChange={(event) => setParticipantEditor({ ...participantEditor, lastName: event.target.value })} /></div></div>
              <div className={`field ${participantEditor.candidate ? "field-readonly" : ""}`}><label htmlFor="participant-external-id">{t("groupPage.participantExternalId")}</label><input id="participant-external-id" readOnly={Boolean(participantEditor.candidate)} value={participantEditor.externalId} onChange={(event) => setParticipantEditor({ ...participantEditor, externalId: event.target.value })} /></div>
              <p className="muted">{checkingEmail ? t("groupPage.participantLookupChecking") : participantEditor.candidate ? t("groupPage.participantLookupFound", { name: participantEditor.candidate.name || participantEditor.candidate.email }) : t("groupPage.participantLookupNew")}</p>
              <p className="muted">{t("groupPage.pendingAccountHelp")}</p>
              {error ? <p className="error" role="alert">{error}</p> : null}
              <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setParticipantEditor(null)}>{t("common.cancel")}</button><button disabled={saving || checkingEmail} type="submit">{saving ? t("common.saving") : t("groupPage.addParticipant")}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {deleteState?.step === "options" ? <div className="dialog-backdrop" role="presentation"><section aria-labelledby="participant-group-delete-title" aria-modal="true" className="dialog-panel" role="dialog"><div><p className="eyebrow">{t("courseDetail.deleteGroupEyebrow")}</p><h2 id="participant-group-delete-title">{t("courseDetail.deleteGroupTitle")}</h2></div><p>{t("courseDetail.deleteGroupParticipantsMessage", { title: deleteState.group.title, count: deleteState.participants.length })}</p><form className="form" onSubmit={submitDeleteOptions}><label className="checkbox-row"><input checked={deleteState.mode === "move"} name="participant-group-delete-mode" type="radio" onChange={() => setDeleteState({ ...deleteState, mode: "move" })} /><span>{t("courseDetail.moveGroupParticipants")}</span></label>{deleteState.mode === "move" ? <div className="field"><label htmlFor="participant-destination-group">{t("courseDetail.destinationGroup")}</label><select id="participant-destination-group" required value={deleteState.targetGroupId} onChange={(event) => setDeleteState({ ...deleteState, targetGroupId: event.target.value })}><option value="">{t("courseDetail.chooseDestinationGroup")}</option>{groups.filter((group) => group.id !== deleteState.group.id).map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}</select><p className="muted">{t("courseDetail.moveGroupParticipantsHelp")}</p></div> : null}<label className="checkbox-row"><input checked={deleteState.mode === "delete"} name="participant-group-delete-mode" type="radio" onChange={() => setDeleteState({ ...deleteState, mode: "delete" })} /><span>{t("courseDetail.deleteGroupParticipants")}</span></label>{error ? <p className="error">{error}</p> : null}<div className="dialog-actions"><button className="secondary" type="button" onClick={() => setDeleteState(null)}>{t("common.cancel")}</button><button className={deleteState.mode === "delete" ? "danger" : ""} disabled={saving || (deleteState.mode === "move" && !deleteState.targetGroupId)} type="submit">{saving ? t("common.saving") : t("courseDetail.continueGroupDeletion")}</button></div></form></section></div> : null}
      <ConfirmationDialog open={deleteState?.step === "confirm-empty"} eyebrow={t("courseDetail.deleteGroupEyebrow")} title={t("courseDetail.deleteGroupTitle")} message={t("courseDetail.deleteEmptyGroupConfirm", { title: deleteState?.group.title ?? "" })} confirmLabel={t("courseDetail.deleteGroupAction")} cancelLabel={t("common.cancel")} confirmVariant="danger" isConfirming={saving} onCancel={() => setDeleteState(null)} onConfirm={() => void deleteGroup({ action: "delete" })} />
      <ConfirmationDialog open={deleteState?.step === "confirm-permanent"} eyebrow={t("courseDetail.deleteGroupPermanentEyebrow")} title={t("courseDetail.deleteGroupPermanentTitle")} message={t("courseDetail.deleteGroupPermanentConfirm", { title: deleteState?.group.title ?? "", count: deleteState?.participants.length ?? 0 })} confirmLabel={t("courseDetail.deleteGroupPermanently")} cancelLabel={t("common.cancel")} confirmVariant="danger" isConfirming={saving} onCancel={() => setDeleteState(null)} onConfirm={() => void deleteGroup({ action: "delete", confirmParticipantDeletion: true })} />
    </section>
  );
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatAvailabilityWindow(from: string | null | undefined, until: string | null | undefined, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (!from && !until) return t("groupPage.availableAlways");
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  if (from && until) return t("groupPage.availableWindow", { from: format(from), until: format(until) });
  if (from) return t("groupPage.availableAfter", { from: format(from) });
  return t("groupPage.availableBefore", { until: format(until as string) });
}
