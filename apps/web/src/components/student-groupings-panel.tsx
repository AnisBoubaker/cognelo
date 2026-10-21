"use client";

import { useApplicationTime, formatZonedDateTime } from "@cognelo/activity-ui";


import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ContextMenu, EditActionBar, getEditActionBarCopy, useDialogs, useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import type { SubjectTeachingLanguage } from "@cognelo/contracts";
import { api, ApiError, type CourseGroup, type StudentGroupingDto, type StudentGroupingStudent } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AppIcon, DisclosureIndicator } from "@/components/app-icon";
import { nextStudentTeamName } from "@/lib/student-groupings";

import { StudentAssignmentDialog, type StudentGroupingDraft as Draft } from "./student-assignment-dialog";

function studentInitials(name: string) {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ""}${words.length > 1 ? words.at(-1)?.[0] ?? "" : ""}`.toLocaleUpperCase();
}
const emptyDraft = (): Draft => ({ title: "", description: "", visibleToStudents: true, assignmentMethod: "manual", studentChoiceEnabled: false, choiceOpensAt: null, choiceClosesAt: null, allowChoiceChanges: false, teams: [] });
const draftFrom = (grouping: StudentGroupingDto): Draft => ({
  title: grouping.title, description: grouping.description, visibleToStudents: grouping.visibleToStudents, assignmentMethod: grouping.assignmentMethod, studentChoiceEnabled: grouping.studentChoiceEnabled,
  choiceOpensAt: grouping.choiceOpensAt, choiceClosesAt: grouping.choiceClosesAt, allowChoiceChanges: grouping.allowChoiceChanges,
  teams: grouping.teams.map((team) => ({ ...team, key: team.id }))
});

export function CourseStudentGroupingsPanel({ courseId, groups, teachingLanguage, initialGroupId }: { courseId: string; groups: CourseGroup[]; teachingLanguage: SubjectTeachingLanguage; initialGroupId?: string | null }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(initialGroupId ?? groups[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const groupId = groups.some((group) => group.id === selectedId) ? selectedId : groups[0]?.id;
  const sectionSelector = <div className="field student-groupings-section-picker">
    <label htmlFor="groupings-section">{t("studentGroupings.section")}</label>
    <select id="groupings-section" value={groupId ?? ""} disabled={editing || !groups.length} onChange={(event) => setSelectedId(event.target.value)}>
      {groups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
    </select>
  </div>;
  return <div className="stack student-groupings-workspace">
    {groupId ? <StudentGroupingsPanel key={groupId} courseId={courseId} groupId={groupId} teachingLanguage={teachingLanguage} onEditingChange={setEditing} sectionSelector={sectionSelector} /> : <>{sectionSelector}<p>{t("studentGroupings.noSections")}</p></>}
  </div>;
}

export function StudentGroupingsPanel({ courseId, groupId, teachingLanguage, onEditingChange, sectionSelector }: {
  courseId: string; groupId: string; teachingLanguage: SubjectTeachingLanguage; onEditingChange?: (editing: boolean) => void; sectionSelector?: ReactNode;
}) {
  const { timeZone } = useApplicationTime();
  const { locale, t } = useI18n();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const copy = getEditActionBarCopy(locale);
  const [groupings, setGroupings] = useState<StudentGroupingDto[]>([]);
  const [expandedGroupingId, setExpandedGroupingId] = useState<string | null>(null);
  const [groupingMenu, setGroupingMenu] = useState<{ groupingId: string; anchor: HTMLButtonElement } | null>(null);
  const [students, setStudents] = useState<StudentGroupingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<StudentGroupingDto | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const saving = useRef(false);
  const isDirty = editing && JSON.stringify(draft) !== JSON.stringify(saved ? draftFrom(saved) : emptyDraft());

  const errorMessage = useCallback((caught: unknown) => {
    const keys: Record<string, string> = {
      STUDENT_GROUPING_TITLE_EXISTS: "duplicateGrouping", STUDENT_GROUPING_TEAM_NAMES_DUPLICATE: "duplicateTeam",
      STUDENT_GROUPING_MEMBERS_DUPLICATE: "duplicateMember", STUDENT_GROUPING_MEMBERS_INVALID: "invalidMember",
      STUDENT_GROUPING_TEAMS_INVALID: "invalidTeam", STUDENT_GROUPING_CONFLICT: "conflict", STUDENT_TEAM_CAPACITY_EXCEEDED: "capacityExceeded"
    };
    return t(`studentGroupings.${caught instanceof ApiError && caught.code && keys[caught.code] ? keys[caught.code] : "error"}`);
  }, [t]);

  useEffect(() => {
    let active = true;
    api.studentGroupings(courseId, groupId).then((result) => {
      if (active) { setGroupings(result.groupings); setStudents(result.students); setLoading(false); }
    }).catch((caught) => { if (active) { setError(errorMessage(caught)); setLoading(false); } });
    return () => { active = false; };
  }, [courseId, groupId, errorMessage]);

  useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);

  const reset = useCallback(() => { setDraft(saved ? draftFrom(saved) : emptyDraft()); setError(""); }, [saved]);
  const save = useCallback(async () => {
    if (saving.current) throw new Error("A save is already in progress.");
    saving.current = true;
    setBusy(true); setError("");
    try {
      const input = { ...draft, teams: draft.teams.map(({ key: _key, ...team }) => team) };
      const result = saved
        ? await api.updateStudentGrouping(courseId, groupId, saved.id, { ...input, revision: saved.revision })
        : await api.createStudentGrouping(courseId, groupId, input);
      setGroupings((current) => [...current.filter((grouping) => grouping.id !== result.grouping.id), result.grouping]);
      setSaved(result.grouping); setDraft(draftFrom(result.grouping));
      setExpandedGroupingId(result.grouping.id);
      notifications.success(t(saved ? "studentGroupings.saved" : "studentGroupings.created"));
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    } finally { setBusy(false); saving.current = false; }
  }, [courseId, draft, errorMessage, groupId, notifications, saved, t]);
  useUnsavedChangesGuard({ isDirty, onSave: save, onDiscard: reset });

  async function close() {
    if (isDirty && !await dialogs.confirm({ message: t("studentGroupings.discardConfirm"), confirmLabel: t("studentGroupings.discard") })) return;
    setEditing(false); setError("");
  }
  function edit(grouping: StudentGroupingDto | null) {
    if (grouping) setExpandedGroupingId(grouping.id);
    setSaved(grouping); setDraft(grouping ? draftFrom(grouping) : emptyDraft());
    setSearch(""); setUnassignedOnly(false); setError(""); setEditing(true);
  }
  async function reload() {
    if (isDirty && !await dialogs.confirm({ message: t("studentGroupings.discardConfirm"), confirmLabel: t("studentGroupings.discard") })) return;
    setBusy(true);
    try {
      const result = await api.studentGroupings(courseId, groupId);
      setGroupings(result.groupings); setStudents(result.students); setError("");
      if (editing) {
        const latest = result.groupings.find((grouping) => grouping.id === saved?.id) ?? null;
        if (saved && !latest) setEditing(false);
        setSaved(latest); setDraft(latest ? draftFrom(latest) : emptyDraft());
      }
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  async function remove(grouping: StudentGroupingDto) {
    if (!await dialogs.confirm({ message: t("studentGroupings.deleteConfirm", { title: grouping.title }), confirmLabel: t("common.remove"), confirmVariant: "danger" })) return;
    setBusy(true); setError("");
    try {
      await api.deleteStudentGrouping(courseId, groupId, grouping.id, grouping.revision);
      setGroupings((current) => current.filter((item) => item.id !== grouping.id));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  const assignments = new Map(draft.teams.flatMap((team) => team.participantIds.map((id) => [id, team.key] as const)));
  const visibleStudents = students.filter((student) =>
    (!unassignedOnly || !assignments.has(student.id)) &&
    `${student.firstName} ${student.lastName} ${student.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const names = new Map(students.map((student) => [student.id, `${student.firstName} ${student.lastName}`.trim() || student.email]));

  const methodLabel = (method: Draft["assignmentMethod"]) => t(`studentGroupings.${method === "student_choice" ? "studentChoiceMethod" : method === "random" ? "randomMethod" : "manualMethod"}`);
  const formatChoiceDate = (value: string | null, fallback: string) => value
    ? formatZonedDateTime(new Date(value), timeZone, locale, { dateStyle: "medium", timeStyle: "short" }) : t(`studentGroupings.${fallback}`);
  const choiceSummary = (value: Draft | StudentGroupingDto) => value.studentChoiceEnabled ? <div className="student-grouping-choice-summary">
    <span>{t("studentGroupings.choiceFrom")}: <strong>{formatChoiceDate(value.choiceOpensAt, "immediately")}</strong></span>
    <span>{t("studentGroupings.choiceUntil")}: <strong>{formatChoiceDate(value.choiceClosesAt, "noDeadline")}</strong></span>
    <span>{t(value.allowChoiceChanges ? "studentGroupings.studentChangesAllowed" : "studentGroupings.studentChangesLocked")}</span>
    {!value.visibleToStudents ? <span className="student-grouping-hidden-note">{t("studentGroupings.hiddenChoiceHelp")}</span> : null}
  </div> : null;

  return <section className="stack student-groupings">
    <div className="section-heading student-groupings-heading">
      {sectionSelector}
      {editing ? <button type="button" className="secondary" disabled={busy} onClick={() => void close()}>{t("common.close")}</button>
        : <button type="button" disabled={loading || busy} onClick={() => edit(null)}><AppIcon name="add" />{t("studentGroupings.create")}</button>}
    </div>
    {error ? <div role="alert"><p className="error">{error}</p><button className="secondary" type="button" disabled={busy} onClick={() => void reload()}>{t("studentGroupings.reload")}</button></div> : null}
    {loading ? <p>{t("common.loading")}</p> : editing ? <form id="student-grouping-form" className="form" aria-label={t(saved ? "studentGroupings.edit" : "studentGroupings.create")} onSubmit={(event) => { event.preventDefault(); void save().catch(() => {}); }}>
      <fieldset className="student-grouping-fields stack" disabled={busy}>
        <div className="field"><label htmlFor="student-grouping-title">{t("studentGroupings.name")}</label><input id="student-grouping-title" value={draft.title} maxLength={120} required onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
        <div className="field"><label htmlFor="student-grouping-description">{t("studentGroupings.description")}</label><textarea id="student-grouping-description" value={draft.description} maxLength={2000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
        <div className="student-grouping-settings">
          <section className="student-grouping-setting" aria-label={t("studentGroupings.studentVisibility")}>
            <h3>{t("studentGroupings.studentVisibility")}</h3>
            <label className="checkbox-row"><input type="checkbox" checked={draft.visibleToStudents} onChange={(event) => setDraft({ ...draft, visibleToStudents: event.target.checked })} />{t("studentGroupings.showToStudents")}</label>
            <p className="muted">{t(draft.visibleToStudents ? "studentGroupings.visibleHelp" : "studentGroupings.hiddenHelp")}</p>
          </section>
          <section className="student-grouping-setting" aria-label={t("studentGroupings.assignmentMethod")}>
            <h3>{t("studentGroupings.assignmentMethod")}</h3>
            <strong className="student-grouping-method">{methodLabel(draft.assignmentMethod)}</strong>
            {choiceSummary(draft)}
            {!draft.studentChoiceEnabled ? <p className="muted">{t(draft.assignmentMethod === "random" ? "studentGroupings.randomMethodHelp" : "studentGroupings.manualMethodHelp")}</p> : null}
            <div className="student-grouping-setting-actions">
              <button className="secondary" type="button" disabled={!draft.teams.length} onClick={() => setAssignmentDialogOpen(true)}>{t("studentGroupings.automaticAssign")}</button>
              {draft.assignmentMethod !== "manual" ? <button className="secondary" type="button" onClick={() => setDraft({ ...draft, assignmentMethod: "manual", studentChoiceEnabled: false, choiceOpensAt: null, choiceClosesAt: null, allowChoiceChanges: false })}>{t("studentGroupings.useManual")}</button> : null}
            </div>
          </section>
        </div>
        <div className="section-heading"><h3>{t("studentGroupings.teams")}</h3><button className="secondary" type="button" disabled={draft.teams.length >= 500} onClick={() => setDraft((current) => ({ ...current, teams: [...current.teams, { key: crypto.randomUUID(), title: nextStudentTeamName(current.teams.map((team) => team.title), teachingLanguage), capacity: 4, participantIds: [] }] }))}>{t("studentGroupings.addTeam")}</button></div>
        {draft.teams.length ? draft.teams.map((team, index) => <div className="student-team-editor" key={team.key}>
          <div className="field"><input aria-label={t("studentGroupings.teamName", { number: index + 1 })} id={`team-${team.key}`} value={team.title} required maxLength={120} onChange={(event) => setDraft({ ...draft, teams: draft.teams.map((item) => item.key === team.key ? { ...item, title: event.target.value } : item) })} /></div>
          <div className="field student-team-capacity"><label htmlFor={`team-capacity-${team.key}`}>{t("studentGroupings.slotsPerTeam")}</label><input id={`team-capacity-${team.key}`} aria-label={t("studentGroupings.teamSlotLabel", { team: team.title })} type="number" min={team.participantIds.length} max={5000} required value={Number.isFinite(team.capacity) ? team.capacity : ""} onChange={(event) => setDraft({ ...draft, teams: draft.teams.map((item) => item.key === team.key ? { ...item, capacity: event.target.valueAsNumber } : item) })} /></div>
          <span className="muted">{t("studentGroupings.memberCount", { count: team.participantIds.length })}</span>
          <button className="secondary" type="button" aria-label={t("studentGroupings.removeTeam", { number: index + 1 })} onClick={() => setDraft({ ...draft, teams: draft.teams.filter((item) => item.key !== team.key) })}>{t("common.remove")}</button>
        </div>) : <p className="muted">{t("studentGroupings.noTeams")}</p>}
        <div className="section-heading">
          <h3>{t("studentGroupings.students")}</h3>
        </div>
        <p className="muted">{t("studentGroupings.assignmentHelp", { count: students.length - assignments.size })}</p>
        <div className="field"><label htmlFor="grouping-student-search">{t("studentGroupings.search")}</label><input id="grouping-student-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label className="checkbox-row"><input type="checkbox" checked={unassignedOnly} onChange={(event) => setUnassignedOnly(event.target.checked)} />{t("studentGroupings.unassignedOnly")}</label>
        <div className="student-grouping-roster">
          {visibleStudents.map((student) => <div className="student-grouping-student" key={student.id}>
            <label htmlFor={`student-team-${student.id}`}><strong>{names.get(student.id)}</strong><span className="muted">{student.email}</span></label>
            <select id={`student-team-${student.id}`} value={assignments.get(student.id) ?? ""} onChange={(event) => setDraft({ ...draft, teams: draft.teams.map((team) => ({ ...team, participantIds: [...team.participantIds.filter((id) => id !== student.id), ...(team.key === event.target.value ? [student.id] : [])].sort() })) })}>
              <option value="">{t("studentGroupings.unassigned")}</option>
              {draft.teams.map((team, index) => <option key={team.key} value={team.key} disabled={team.participantIds.length >= team.capacity && !team.participantIds.includes(student.id)}>{team.title || t("studentGroupings.teamName", { number: index + 1 })}</option>)}
            </select>
          </div>)}
          {!visibleStudents.length ? <p className="muted">{t(students.length ? "studentGroupings.noMatches" : "studentGroupings.noStudents")}</p> : null}
        </div>
      </fieldset>
      <EditActionBar isDirty={isDirty} isSaving={busy} savedLabel={copy.saved} unsavedLabel={copy.unsaved} saveLabel={t(saved ? "studentGroupings.save" : "studentGroupings.create")} savingLabel={copy.saving} cancelLabel={copy.cancel} onCancel={reset} form="student-grouping-form" saveDisabled={!draft.title.trim() || draft.teams.some((team) => !team.title.trim() || !Number.isInteger(team.capacity) || team.capacity < team.participantIds.length || team.capacity > 5000)} />
    </form> : groupings.length ? <div className="participant-group-list student-grouping-list">{[...groupings].sort((a, b) => a.title.localeCompare(b.title)).map((grouping) => {
      const expanded = expandedGroupingId === grouping.id;
      const toggleId = `grouping-toggle-${grouping.id}`;
      const panelId = `grouping-details-${grouping.id}`;
      return <article className={`participant-group-card${expanded ? " is-open" : ""}`} key={grouping.id} aria-label={grouping.title}>
        <header className="participant-group-heading">
          <h3 className="participant-group-summary" aria-label={grouping.title}>
            <button className="participant-group-toggle" type="button" id={toggleId} aria-label={grouping.title} aria-describedby={`${toggleId}-summary`} aria-controls={panelId} aria-expanded={expanded} onClick={() => setExpandedGroupingId((current) => current === grouping.id ? null : grouping.id)}>
              <DisclosureIndicator expanded={expanded} />
              <span className="participant-group-icon"><AppIcon name={expanded ? "folderOpen" : "folder"} size={22} stroke={1.8} /></span>
              <span className="participant-group-labels">
                <span className="participant-group-name">{grouping.title}</span>
                <span className="participant-group-meta" id={`${toggleId}-summary`}>
                  <span>{t("studentGroupings.teams")}: {grouping.teams.length}</span>
                  <span>{t("studentGroupings.assignmentSummary", { method: methodLabel(grouping.assignmentMethod) })}</span>
                  <span className={grouping.visibleToStudents ? undefined : "student-grouping-hidden-note"}>{t(grouping.visibleToStudents ? "studentGroupings.visibleToStudents" : "studentGroupings.hiddenFromStudents")}</span>
                </span>
              </span>
            </button>
          </h3>
          <button className="participant-group-menu-button" type="button" aria-haspopup="menu" aria-expanded={groupingMenu?.groupingId === grouping.id} aria-label={`${grouping.title}: ${t("courseDetail.actionsHeader")}`} disabled={busy} onClick={(event) => setGroupingMenu(groupingMenu?.groupingId === grouping.id ? null : { groupingId: grouping.id, anchor: event.currentTarget })}>
            <AppIcon name="more" />
          </button>
          <ContextMenu anchor={groupingMenu?.groupingId === grouping.id ? groupingMenu.anchor : null} open={groupingMenu?.groupingId === grouping.id} onClose={() => setGroupingMenu(null)} className="content-context-menu">
            <button className="content-context-menu-item" role="menuitem" type="button" disabled={busy} onClick={() => { setGroupingMenu(null); edit(grouping); }}><AppIcon name="edit" />{t("common.edit")}</button>
            <button className="content-context-menu-item is-danger" role="menuitem" type="button" disabled={busy} onClick={() => { setGroupingMenu(null); void remove(grouping); }}><AppIcon name="remove" />{t("common.remove")}</button>
          </ContextMenu>
        </header>
        <div className="student-grouping-details" role="region" id={panelId} aria-labelledby={toggleId} hidden={!expanded}>
          {expanded ? <>
            {grouping.description || grouping.studentChoiceEnabled ? <div className="student-grouping-policy">
              {grouping.description ? <p className="muted">{grouping.description}</p> : null}
              {choiceSummary(grouping)}
            </div> : null}
            <div className="student-team-cards">{grouping.teams.map((team) => <section key={team.id} className="student-team-card" aria-label={team.title}>
              <h4>{team.title} <span className="student-team-count">({team.participantIds.length})</span></h4>
              {team.participantIds.length ? <ul className="student-team-members" role="list">{team.participantIds.map((id) => {
                const name = names.get(id) ?? t("studentGroupings.unavailableStudent");
                return <li key={id}><span className="student-team-avatar" aria-hidden="true">{studentInitials(name)}</span><span>{name}</span></li>;
              })}</ul> : <p className="student-team-empty muted">{t("studentGroupings.emptyTeam")}</p>}
            </section>)}</div>
            {!grouping.teams.length ? <p className="student-grouping-no-teams muted">{t("studentGroupings.noTeams")}</p> : null}
            <footer className="student-grouping-card-footer">
              <span className="student-grouping-unassigned"><AppIcon name="participants" size={16} />{t("studentGroupings.unassignedCount", { count: students.length - grouping.teams.reduce((count, team) => count + team.participantIds.length, 0) })}</span>
            </footer>
          </> : null}
        </div>
      </article>;
    })}</div> : <p className="muted">{t("studentGroupings.empty")}</p>}
    {assignmentDialogOpen ? <StudentAssignmentDialog draft={draft} studentIds={students.map((student) => student.id)} onClose={() => setAssignmentDialogOpen(false)} onApply={(updated) => { setDraft(updated); setSearch(""); setUnassignedOnly(false); setAssignmentDialogOpen(false); }} /> : null}
  </section>;
}
