"use client";

import { ConfirmationDialog } from "@cognelo/activity-ui";
import { ChangeEvent, FocusEvent, FormEvent, useEffect, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { DateTimeMinuteInput } from "@/components/date-time-minute-input";
import {
  api,
  ApiError,
  type CourseGroup,
  type GroupParticipant,
  type GroupParticipantCandidate
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { parseParticipantCsv, type ParticipantCsvIssue, type ParticipantCsvRow } from "@/lib/participant-csv";

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

type ParticipantImportState = {
  group: CourseGroup;
  fileName: string;
  fileContents: string;
  includesAssignedPasswords: boolean;
  rows: ParticipantCsvRow[];
  issues: ParticipantCsvIssue[];
  importing: boolean;
  completed: number;
  result: {
    imported: number;
    skipped: number;
    failures: Array<{ line: number; email: string; message: string }>;
  } | null;
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
  const [participantImport, setParticipantImport] = useState<ParticipantImportState | null>(null);
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

  function openParticipantImport(group: CourseGroup) {
    setError("");
    setParticipantImport({ group, fileName: "", fileContents: "", includesAssignedPasswords: false, rows: [], issues: [], importing: false, completed: 0, result: null });
  }

  async function selectParticipantCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !participantImport) return;
    if (file.size > 1_000_000) {
      setParticipantImport({ ...participantImport, fileName: file.name, fileContents: "", rows: [], issues: [{ code: "file_too_large" }], result: null });
      return;
    }
    const fileContents = await file.text();
    const parsed = parseParticipantCsv(fileContents, { includesAssignedPasswords: participantImport.includesAssignedPasswords });
    setParticipantImport({ ...participantImport, fileName: file.name, fileContents, rows: parsed.rows, issues: parsed.issues, completed: 0, result: null });
  }

  function setParticipantImportPasswordMode(includesAssignedPasswords: boolean) {
    if (!participantImport || participantImport.importing) return;
    const parsed = participantImport.fileContents
      ? parseParticipantCsv(participantImport.fileContents, { includesAssignedPasswords })
      : { rows: [], issues: [] };
    setParticipantImport({
      ...participantImport,
      includesAssignedPasswords,
      rows: parsed.rows,
      issues: parsed.issues,
      completed: 0,
      result: null
    });
  }

  async function importParticipants() {
    if (!participantImport || participantImport.issues.length || !participantImport.rows.length) return;
    const importGroup = participantImport.group;
    const rows = participantImport.rows;
    const existingEmails = new Set((groupDetails[importGroup.id]?.participants ?? importGroup.participants ?? []).map((participant) => participant.email.toLowerCase()));
    let imported = 0;
    let skipped = 0;
    const failures: Array<{ line: number; email: string; message: string }> = [];
    setParticipantImport({ ...participantImport, importing: true, completed: 0, result: null });

    for (const [index, row] of rows.entries()) {
      if (existingEmails.has(row.email)) {
        skipped += 1;
      } else {
        try {
          await api.addGroupParticipant(courseId, importGroup.id, {
            role: "student",
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            assignedPassword: row.assignedPassword ?? undefined,
            externalId: row.externalId
          });
          imported += 1;
          existingEmails.add(row.email);
        } catch (err) {
          if (err instanceof ApiError && err.code === "GROUP_PARTICIPANT_EXISTS") {
            skipped += 1;
            existingEmails.add(row.email);
          } else {
            failures.push({ line: row.line, email: row.email, message: err instanceof Error ? err.message : t("groupPage.participantCreateError") });
          }
        }
      }
      setParticipantImport((current) => current ? { ...current, completed: index + 1 } : current);
    }

    setParticipantImport((current) => current ? {
      ...current,
      fileContents: "",
      rows: current.rows.map((row) => ({ ...row, assignedPassword: null })),
      importing: false,
      result: { imported, skipped, failures }
    } : current);
    if (imported) {
      await loadGroupDetails();
      await onChanged();
    }
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
                    <button className="secondary" type="button" onClick={() => openParticipantImport(detail)}>
                      <AppIcon name="upload" />
                      <span>{t("groupPage.importParticipants")}</span>
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
      {error && !editor && !participantEditor && !participantImport && !deleteState ? <p className="error" role="alert">{error}</p> : null}

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

      {participantImport ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="participant-import-title" aria-modal="true" className="dialog-panel participant-import-dialog" role="dialog">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{participantImport.group.title}</p>
                <h2 id="participant-import-title">{t("groupPage.importParticipantsTitle")}</h2>
                <p className="muted">{t("groupPage.importParticipantsText")}</p>
              </div>
              <button className="secondary icon-button" disabled={participantImport.importing} type="button" title={t("common.close")} onClick={() => setParticipantImport(null)}><AppIcon name="close" /></button>
            </div>
            <div className="form">
              <label className="checkbox-row">
                <input
                  checked={participantImport.includesAssignedPasswords}
                  disabled={participantImport.importing}
                  type="checkbox"
                  onChange={(event) => setParticipantImportPasswordMode(event.target.checked)}
                />
                <span>{t("groupPage.importIncludesAssignedPasswords")}</span>
              </label>
              <p className="muted">{t("groupPage.importIncludesAssignedPasswordsHelp")}</p>
              <div className="field">
                <label htmlFor="participant-csv-file">{t("groupPage.importFileLabel")}</label>
                <input accept=".csv,text/csv" disabled={participantImport.importing} id="participant-csv-file" type="file" onChange={(event) => void selectParticipantCsv(event)} />
                <p className="muted">{t(participantImport.includesAssignedPasswords ? "groupPage.importFormatHelpWithPasswords" : "groupPage.importFormatHelp")}</p>
                <code className="participant-import-template">
                  {participantImport.includesAssignedPasswords
                    ? "Anonymous,Student,anonymous-1@example.invalid,AssignedPassword,20260001"
                    : "Ada,Lovelace,ada@example.org,20260001"}
                </code>
              </div>

              {participantImport.fileName ? <p className="muted">{t("groupPage.importFileSelected", { name: participantImport.fileName })}</p> : null}
              {participantImport.rows.length && !participantImport.issues.length ? (
                <p className="participant-import-ready">{t("groupPage.importReady", { count: participantImport.rows.length })}</p>
              ) : null}
              {participantImport.issues.length ? (
                <div className="participant-import-issues" role="alert">
                  <p className="error">{t("groupPage.importIssues", { count: participantImport.issues.length })}</p>
                  <ul>
                    {participantImport.issues.slice(0, 10).map((issue, index) => <li key={`${issue.code}-${issue.line ?? 0}-${index}`}>{formatParticipantCsvIssue(issue, t)}</li>)}
                  </ul>
                  {participantImport.issues.length > 10 ? <p className="muted">{t("groupPage.importMoreIssues", { count: participantImport.issues.length - 10 })}</p> : null}
                </div>
              ) : null}
              {participantImport.importing ? (
                <p>{t("groupPage.importProgress", { completed: participantImport.completed, total: participantImport.rows.length })}</p>
              ) : null}
              {participantImport.result ? (
                <div className="participant-import-result" role="status">
                  <p>{t("groupPage.importResult", { imported: participantImport.result.imported, skipped: participantImport.result.skipped, failed: participantImport.result.failures.length })}</p>
                  {participantImport.result.failures.length ? <>
                    <p className="muted">{t("groupPage.importPartialHelp")}</p>
                    <ul>{participantImport.result.failures.slice(0, 10).map((failure) => <li key={`${failure.line}-${failure.email}`}>{t("groupPage.importFailure", failure)}</li>)}</ul>
                  </> : null}
                </div>
              ) : null}
              <div className="dialog-actions">
                <button className="secondary" disabled={participantImport.importing} type="button" onClick={() => setParticipantImport(null)}>{participantImport.result ? t("common.close") : t("common.cancel")}</button>
                {!participantImport.result ? <button disabled={participantImport.importing || Boolean(participantImport.issues.length) || !participantImport.rows.length} type="button" onClick={() => void importParticipants()}>{participantImport.importing ? t("groupPage.importingParticipants") : t("groupPage.importParticipantsAction")}</button> : null}
              </div>
            </div>
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

function formatParticipantCsvIssue(issue: ParticipantCsvIssue, t: (key: string, vars?: Record<string, string | number>) => string) {
  const field = issue.field ? t(`groupPage.importField${capitalize(issue.field)}`) : "";
  if (issue.code === "empty_file") return t("groupPage.importIssueEmptyFile");
  if (issue.code === "file_too_large") return t("groupPage.importIssueFileTooLarge");
  if (issue.code === "missing_value") return t("groupPage.importIssueMissingValue", { line: issue.line ?? 0, field });
  if (issue.code === "password_too_short") return t("groupPage.importIssuePasswordTooShort", { line: issue.line ?? 0, min: issue.value ?? "8" });
  if (issue.code === "invalid_email") return t("groupPage.importIssueInvalidEmail", { line: issue.line ?? 0, value: issue.value ?? "" });
  if (issue.code === "invalid_column_count") return t("groupPage.importIssueColumnCount", { line: issue.line ?? 0, count: issue.value ?? "", expected: issue.expected ?? "" });
  if (issue.code === "malformed_csv") return t("groupPage.importIssueMalformedCsv", { line: issue.line ?? 0 });
  if (issue.code === "duplicate_email") return t("groupPage.importIssueDuplicateEmail", { line: issue.line ?? 0, value: issue.value ?? "" });
  if (issue.code === "too_long") return t("groupPage.importIssueTooLong", { line: issue.line ?? 0, field, max: issue.value ?? "" });
  if (issue.code === "too_many_rows") return t("groupPage.importIssueTooManyRows", { max: issue.value ?? "500" });
  return t("groupPage.importIssueUnclosedQuote", { line: issue.line ?? 0 });
}
