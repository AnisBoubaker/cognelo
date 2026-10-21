"use client";

import { useServerNow, useApplicationTime, formatZonedDateTime } from "@cognelo/activity-ui";


import { useCallback, useEffect, useRef, useState } from "react";
import type { MyStudentGroupingDto } from "@cognelo/contracts";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function MyTeamsPanel({ courseId, groupId }: { courseId: string; groupId: string }) {
  const { t } = useI18n();
  const [groupings, setGroupings] = useState<MyStudentGroupingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const active = useRef(false);
  const requestNumber = useRef(0);
  const reload = useCallback(async () => {
    const request = ++requestNumber.current;
    try {
      const result = await api.myStudentGroupings(courseId, groupId);
      if (active.current && request === requestNumber.current) { setGroupings(result.groupings); setError(false); }
    } catch {
      if (active.current && request === requestNumber.current) setError(true);
    } finally {
      if (active.current && request === requestNumber.current) setLoading(false);
    }
  }, [courseId, groupId]);
  useEffect(() => {
    active.current = true;
    void reload();
    const interval = window.setInterval(() => { if (!document.hidden) void reload(); }, 15000);
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => { active.current = false; window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [reload]);

  return <section className="section stack my-teams-panel">
    <h2>{t("studentGroupings.myTeams")}</h2>
    {error ? <div role="alert"><p className="error">{t("studentGroupings.myTeamsError")}</p><button type="button" className="secondary" onClick={() => void reload()}>{t("common.retry")}</button></div> : null}
    {loading ? <p>{t("common.loading")}</p> : groupings.length ? groupings.map((grouping) => <MyGrouping key={grouping.id} grouping={grouping} courseId={courseId} groupId={groupId} reload={reload} />) : <p className="muted">{t("studentGroupings.noMyTeams")}</p>}
  </section>;
}

function MyGrouping({ grouping, courseId, groupId, reload }: { grouping: MyStudentGroupingDto; courseId: string; groupId: string; reload: () => Promise<void> }) {
  const { timeZone } = useApplicationTime();
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState(grouping.ownTeamId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const now = useServerNow();
  const submitting = useRef(false);
  useEffect(() => { setSelected(grouping.ownTeamId ?? ""); }, [grouping.ownTeamId]);

  const choiceEnabled = grouping.choiceState !== "disabled";
  const closed = choiceEnabled && grouping.choiceClosesAt && now >= Date.parse(grouping.choiceClosesAt);
  const state = closed ? "closed" : grouping.choiceState;
  const open = state === "open";
  const displayedSelection = open ? selected : grouping.ownTeamId;
  const selectedTeam = grouping.teams.find((team) => team.id === selected);
  const canConfirm = open && selectedTeam && selected !== grouping.ownTeamId && selectedTeam.members.length < selectedTeam.capacity;
  const date = (value: string) => formatZonedDateTime(new Date(value), timeZone, locale, { dateStyle: "medium", timeStyle: "short" });

  async function confirm() {
    if (!canConfirm || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await api.chooseStudentTeam(courseId, groupId, grouping.id, selected);
      setMessage(t("studentGroupings.choiceSaved"));
    } catch (caught) {
      const keys: Record<string, string> = { STUDENT_TEAM_FULL: "teamFull", STUDENT_TEAM_CHOICE_CONFLICT: "choiceConflict", STUDENT_TEAM_CHOICE_LOCKED: "choiceLocked", STUDENT_TEAM_CHOICE_NOT_OPEN: "choiceNotOpen" };
      setError(t(`studentGroupings.${caught instanceof ApiError && caught.code && keys[caught.code] ? keys[caught.code] : "myTeamsError"}`));
    } finally {
      await reload(); submitting.current = false; setBusy(false);
    }
  }

  return <article className="student-grouping-card" aria-label={grouping.title}>
    <header className="student-grouping-card-header"><div className="student-grouping-card-title">
      <h3>{grouping.title}</h3>
      {choiceEnabled ? <p className="muted">{t(`studentGroupings.choiceStatus_${state}`)}</p> : !grouping.ownTeamId ? <p className="muted">{t("studentGroupings.notAssigned")}</p> : null}
      {choiceEnabled && (grouping.choiceOpensAt || grouping.choiceClosesAt) ? <p className="muted student-choice-dates">
        {grouping.choiceOpensAt ? <span>{t("studentGroupings.choiceFrom")}: {date(grouping.choiceOpensAt)}</span> : null}
        {grouping.choiceClosesAt ? <span>{t("studentGroupings.choiceUntil")}: {date(grouping.choiceClosesAt)}</span> : null}
      </p> : null}
    </div></header>
    <div className="student-team-cards">{grouping.teams.map((team) => {
      const remaining = Math.max(0, team.capacity - team.members.length);
      const own = team.id === grouping.ownTeamId;
      return <section className={`student-team-card${displayedSelection === team.id && choiceEnabled ? " is-selected" : ""}`} aria-label={team.title} key={team.id}>
        <h4>{team.title}<span className="student-team-count">{team.members.length} / {team.capacity}</span></h4>
        {own ? <p className="student-team-current">{t("studentGroupings.currentTeam")}</p> : null}
        <ul className="student-team-members" role="list">{team.members.map((member, index) => {
          const words = member.name.trim().split(/\s+/);
          const initials = `${words[0]?.[0] ?? ""}${words.length > 1 ? words.at(-1)?.[0] ?? "" : ""}`.toLocaleUpperCase();
          return <li key={index}><span className="student-team-avatar" aria-hidden="true">{initials}</span><span>{member.name}{member.isSelf ? <small className="muted"> · {t("studentGroupings.you")}</small> : null}</span></li>;
        })}
          {choiceEnabled ? Array.from({ length: Math.min(20, remaining) }, (_, index) => <li className="student-team-open-slot muted" key={`slot-${index}`}><span className="student-team-avatar" aria-hidden="true">+</span><span>{t("studentGroupings.emptySlot")}</span></li>) : null}
          {choiceEnabled && remaining > 20 ? <li className="muted">{t("studentGroupings.moreEmptySlots", { count: remaining - 20 })}</li> : null}
        </ul>
        {open ? <label className="student-team-select"><input type="radio" name={`team-choice-${grouping.id}`} value={team.id} checked={displayedSelection === team.id} disabled={!open || busy || (!remaining && !own)} onChange={() => { setSelected(team.id); setMessage(""); setError(""); }} />{t(own ? "studentGroupings.currentTeam" : remaining ? "studentGroupings.selectTeam" : "studentGroupings.fullTeam")}</label> : null}
      </section>;
    })}</div>
    {choiceEnabled ? <footer className="student-grouping-card-footer student-choice-footer">
      {open ? <><p className="muted">{t(grouping.allowChoiceChanges ? "studentGroupings.changesAllowed" : "studentGroupings.choiceFinal")}</p><button type="button" disabled={!canConfirm || busy} onClick={() => void confirm()}>{t(busy ? "common.saving" : "studentGroupings.confirmChoice")}</button></> : null}
      {message ? <p role="status">{message}</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}
    </footer> : null}
  </article>;
}
