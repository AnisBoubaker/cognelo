"use client";
import { useApplicationTime, fromZonedDateTimeInput } from "@cognelo/activity-ui";

import { useState } from "react";
import { ConfirmationDialog } from "@cognelo/activity-ui";
import type { StudentGroupingInput } from "@cognelo/contracts";
import { DateTimeMinuteInput } from "./date-time-minute-input";
import { useI18n } from "@/lib/i18n";
import { randomlyAssignStudents, toTeamChoiceLocalDate } from "@/lib/student-groupings";

export type StudentGroupingDraft = Omit<StudentGroupingInput, "teams"> & {
  teams: Array<StudentGroupingInput["teams"][number] & { key: string }>;
};

export function StudentAssignmentDialog({ draft, studentIds, onApply, onClose }: {
  draft: StudentGroupingDraft; studentIds: string[]; onApply: (draft: StudentGroupingDraft) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const { timeZone } = useApplicationTime();
  const [mode, setMode] = useState<"random" | "student">(draft.studentChoiceEnabled ? "student" : "random");
  const [scope, setScope] = useState<"unassigned" | "all">("unassigned");
  const [teams, setTeams] = useState(draft.teams.map((team) => ({ ...team })));
  const [bulkCapacity, setBulkCapacity] = useState(draft.teams[0]?.capacity ?? 4);
  const [opensAt, setOpensAt] = useState(toTeamChoiceLocalDate(draft.choiceOpensAt, timeZone));
  const [closesAt, setClosesAt] = useState(toTeamChoiceLocalDate(draft.choiceClosesAt, timeZone));
  const [allowChanges, setAllowChanges] = useState(draft.allowChoiceChanges);
  const validCapacity = (value: number) => Number.isInteger(value) && value >= 0 && value <= 5000;
  const exceedsCapacity = (mode === "student" || scope === "unassigned") && teams.some((team) => team.participantIds.length > team.capacity);
  const invalidDates = Boolean(opensAt && closesAt && opensAt >= closesAt);
  const invalid = !teams.length || teams.some((team) => !validCapacity(team.capacity)) || exceedsCapacity || (mode === "student" && invalidDates);

  function apply() {
    if (invalid) return;
    onApply({
      ...draft, assignmentMethod: mode === "student" ? "student_choice" : "random", studentChoiceEnabled: mode === "student", allowChoiceChanges: mode === "student" && allowChanges,
      choiceOpensAt: mode === "student" && opensAt ? fromZonedDateTimeInput(opensAt, timeZone) : null,
      choiceClosesAt: mode === "student" && closesAt ? fromZonedDateTimeInput(closesAt, timeZone) : null,
      teams: mode === "random" ? randomlyAssignStudents(teams, studentIds, scope) : teams
    });
  }

  return <ConfirmationDialog open title={t("studentGroupings.automaticAssign")} confirmLabel={t("studentGroupings.applyAssignment")} cancelLabel={t("common.cancel")} confirmDisabled={invalid} onCancel={onClose} onConfirm={apply} message={
    <div className="student-assignment-dialog stack">
      <fieldset className="student-assignment-methods">
        <legend>{t("studentGroupings.assignmentMethod")}</legend>
        <label><input type="radio" name="assignment-method" checked={mode === "random"} onChange={() => setMode("random")} />{t("studentGroupings.randomMethod")}</label>
        <label className="muted"><input type="radio" name="assignment-method" disabled />{t("studentGroupings.smartMethod")}<small>{t("studentGroupings.smartComingSoon")}</small></label>
        <label><input type="radio" name="assignment-method" checked={mode === "student"} onChange={() => setMode("student")} />{t("studentGroupings.studentChoiceMethod")}</label>
      </fieldset>
      {mode === "random" ? <fieldset className="student-assignment-methods">
        <legend>{t("studentGroupings.randomScope")}</legend>
        <label><input type="radio" name="assignment-scope" checked={scope === "unassigned"} onChange={() => setScope("unassigned")} />{t("studentGroupings.assignUnassigned")}</label>
        <label><input type="radio" name="assignment-scope" checked={scope === "all"} onChange={() => setScope("all")} />{t("studentGroupings.reassignAll")}</label>
        <p className="muted">{t("studentGroupings.capacityShortfallHelp")}</p>
      </fieldset> : <div className="stack">
        <div className="form-grid-two">
          <div className="field"><label htmlFor="team-choice-from">{t("studentGroupings.choiceFrom")}</label><DateTimeMinuteInput id="team-choice-from" value={opensAt} onChange={setOpensAt} /></div>
          <div className="field"><label htmlFor="team-choice-until">{t("studentGroupings.choiceUntil")}</label><DateTimeMinuteInput id="team-choice-until" value={closesAt} onChange={setClosesAt} /></div>
        </div>
        <p className="muted">{t("studentGroupings.choiceDateHelp")}</p>
        <label className="checkbox-row"><input type="checkbox" checked={allowChanges} onChange={(event) => setAllowChanges(event.target.checked)} />{t("studentGroupings.allowChoiceChanges")}</label>
        {invalidDates ? <p role="alert" className="error">{t("studentGroupings.invalidChoiceDates")}</p> : null}
      </div>}
      <div className="stack">
        <h3>{t("studentGroupings.teamSlots")}</h3>
        <div className="row">
          <div className="field"><label htmlFor="all-team-capacity">{t("studentGroupings.slotsPerTeam")}</label><input id="all-team-capacity" type="number" min={0} max={5000} value={Number.isFinite(bulkCapacity) ? bulkCapacity : ""} onChange={(event) => setBulkCapacity(event.target.valueAsNumber)} /></div>
          <button className="secondary" type="button" disabled={!validCapacity(bulkCapacity)} onClick={() => setTeams((current) => current.map((team) => ({ ...team, capacity: bulkCapacity })))}>{t("studentGroupings.applySlotsToAll")}</button>
        </div>
        <div className="student-assignment-capacities">{teams.map((team) => <div className="field" key={team.key}>
          <label htmlFor={`assignment-capacity-${team.key}`}>{team.title}</label>
          <input id={`assignment-capacity-${team.key}`} aria-label={t("studentGroupings.teamSlotLabel", { team: team.title })} type="number" min={0} max={5000} value={Number.isFinite(team.capacity) ? team.capacity : ""} onChange={(event) => setTeams(teams.map((item) => item.key === team.key ? { ...item, capacity: event.target.valueAsNumber } : item))} />
        </div>)}</div>
        {exceedsCapacity ? <p role="alert" className="error">{t("studentGroupings.capacityExceeded")}</p> : null}
      </div>
      <p className="muted">{t("studentGroupings.automaticAssignmentHelp")}</p>
    </div>
  } />;
}
