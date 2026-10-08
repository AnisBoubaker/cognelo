"use client";

import { FormEvent, useMemo, useState } from "react";
import { useDialogs } from "@cognelo/activity-ui";
import { AppIcon } from "@/components/app-icon";
import { api, type CourseMembership } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function CourseStaffPanel({
  courseId,
  currentUserId,
  memberships,
  onChanged
}: {
  courseId: string;
  currentUserId?: string;
  memberships: CourseMembership[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const dialogs = useDialogs();
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "teacher">("teacher");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const staff = useMemo(
    () => memberships.filter((membership) =>
      membership.source === "explicit" && (membership.role === "owner" || membership.role === "teacher")
    ),
    [memberships]
  );

  async function addStaff(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api.groupParticipantCandidate(courseId, email);
      if (!result.candidate) {
        throw new Error(t("courseDetail.courseStaffExistingAccountRequired"));
      }
      await api.addCourseMembership(courseId, { userId: result.candidate.id, role });
      setAdding(false);
      setEmail("");
      setRole("teacher");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("courseDetail.courseStaffAddError"));
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(membership: CourseMembership) {
    const name = membership.user?.name || membership.user?.email || t("courseDetail.courseStaffMember");
    if (!await dialogs.confirm({
      message: t("courseDetail.courseStaffRemoveConfirm", { name }),
      confirmLabel: t("common.remove"),
      confirmVariant: "danger"
    })) return;
    setRemovingId(membership.id);
    setError("");
    try {
      await api.removeCourseMembership(courseId, membership.id);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("courseDetail.courseStaffRemoveError"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="section stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("courseDetail.courseStaffEyebrow")}</p>
          <h2>{t("courseDetail.courseStaffTitle")}</h2>
          <p className="muted">{t("courseDetail.courseStaffText")}</p>
        </div>
        <button className="secondary" type="button" onClick={() => setAdding((current) => !current)}>
          <AppIcon name={adding ? "close" : "add"} />
          <span>{adding ? t("common.cancel") : t("courseDetail.courseStaffAdd")}</span>
        </button>
      </div>

      {adding ? (
        <form className="form inline-panel" onSubmit={addStaff}>
          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="course-staff-email">{t("courseDetail.courseStaffEmail")}</label>
              <input id="course-staff-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="course-staff-role">{t("courseDetail.courseStaffRole")}</label>
              <select id="course-staff-role" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                <option value="teacher">{t("courseDetail.courseStaffTeacher")}</option>
                <option value="owner">{t("courseDetail.courseStaffOwner")}</option>
              </select>
            </div>
          </div>
          <p className="muted">{t("courseDetail.courseStaffExistingAccountHelp")}</p>
          <div className="row">
            <button disabled={saving} type="submit">{saving ? t("common.saving") : t("courseDetail.courseStaffAdd")}</button>
          </div>
        </form>
      ) : null}

      <div className="table-list">
        {staff.map((membership) => (
          <div className="table-row" key={membership.id}>
            <div className="table-main table-main-stack">
              <strong>{membership.user?.name || membership.user?.email || membership.userId}</strong>
              {membership.user?.email ? <span className="table-meta-note muted">{membership.user.email}</span> : null}
            </div>
            <span>{membership.role === "owner" ? t("courseDetail.courseStaffOwner") : t("courseDetail.courseStaffTeacher")}</span>
            <div className="table-actions">
              <button
                aria-label={t("courseDetail.courseStaffRemove")}
                className="danger icon-button"
                disabled={membership.userId === currentUserId || removingId === membership.id}
                title={membership.userId === currentUserId ? t("courseDetail.courseStaffSelfRemoveBlocked") : t("courseDetail.courseStaffRemove")}
                type="button"
                onClick={() => void removeStaff(membership)}
              >
                <AppIcon name="remove" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}
