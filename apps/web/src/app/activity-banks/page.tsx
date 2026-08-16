"use client";

import { ConfirmationDialog } from "@cognelo/activity-ui";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AppIcon } from "@/components/app-icon";
import { api, type ActivityBank, type Subject } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type BankDraft = { subjectId: string; title: string; description: string };
type DeleteState = { bank: ActivityBank; step: "options" | "confirm-delete"; mode: "move" | "delete"; targetId: string };

export default function ActivityBanksPage() {
  const { t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activityBanks, setActivityBanks] = useState<ActivityBank[]>([]);
  const [editorBank, setEditorBank] = useState<ActivityBank | null | undefined>(undefined);
  const [draft, setDraft] = useState<BankDraft>({ subjectId: "", title: "", description: "" });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPage() {
    const [subjectsResult, banksResult] = await Promise.all([api.subjects(), api.activityBanks()]);
    setSubjects(subjectsResult.subjects);
    setActivityBanks(banksResult.activityBanks);
  }

  useEffect(() => {
    loadPage().catch((err) => setError(err instanceof Error ? err.message : t("activityBanks.loadError")));
  }, []);

  const moveTargets = useMemo(() => {
    if (!deleteState) return [];
    return activityBanks.filter((bank) => bank.id !== deleteState.bank.id && bank.subjectId === deleteState.bank.subjectId && bank.canManage);
  }, [activityBanks, deleteState]);

  function openCreate() {
    setError("");
    setDraft({ subjectId: subjects[0]?.id ?? "", title: "", description: "" });
    setEditorBank(null);
  }

  function openEdit(bank: ActivityBank) {
    setActionMenuId(null);
    setError("");
    setDraft({ subjectId: bank.subjectId, title: bank.title, description: bank.description });
    setEditorBank(bank);
  }

  async function saveActivityBank(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editorBank) await api.updateActivityBank(editorBank.id, draft);
      else await api.createActivityBank({ ...draft, metadata: {} });
      setEditorBank(undefined);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : editorBank ? t("activityBanks.updateError") : t("activityBanks.createError"));
    } finally {
      setSaving(false);
    }
  }

  function openDelete(bank: ActivityBank) {
    setActionMenuId(null);
    const populated = (bank.activities?.length ?? 0) > 0;
    setDeleteState({ bank, step: populated ? "options" : "confirm-delete", mode: populated ? "move" : "delete", targetId: "" });
  }

  async function submitDeleteOptions(event: FormEvent) {
    event.preventDefault();
    if (!deleteState) return;
    if (deleteState.mode === "delete") {
      setDeleteState({ ...deleteState, step: "confirm-delete" });
      return;
    }
    await performDelete({ action: "move", targetActivityBankId: deleteState.targetId });
  }

  async function performDelete(input: { action: "move" | "delete"; targetActivityBankId?: string; force?: boolean }) {
    if (!deleteState) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteActivityBank(deleteState.bank.id, input);
      setDeleteState(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activityBanks.deleteError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact"><div className="hero-meta"><p className="eyebrow">{t("activityBanks.eyebrow")}</p><h1>{t("nav.activityBanks")}</h1><p className="muted">{t("activityBanks.subtitle")}</p></div></section>
        {error ? <p className="error">{error}</p> : null}

        <section className="section stack">
          <div className="section-heading"><div><p className="eyebrow">{t("activityBanks.listEyebrow")}</p><h2>{t("activityBanks.listTitle")}</h2></div><button type="button" onClick={openCreate}>{t("activityBanks.addTitle")}</button></div>
          {activityBanks.length ? (
            <div className="table-list activity-bank-list">
              {activityBanks.map((bank) => (
                <div className="table-row table-row-link activity-bank-list-row" key={bank.id}>
                  <Link className="activity-bank-row-link" href={`/activity-banks/${bank.id}`}>
                    <span className="table-main table-main-stack"><strong>{bank.title}</strong><span className="table-meta-note muted">{bank.subject?.title ?? t("activityBanks.noSubject")}</span></span>
                    <span className="table-meta muted">{t("activityBanks.activityCount", { count: bank.activities?.length ?? 0 })}</span>
                    <span className="table-meta muted">{bank.owner?.name ?? bank.owner?.email ?? ""}</span>
                  </Link>
                  {bank.canManage ? (
                    <div className="content-header-actions">
                      <button aria-expanded={actionMenuId === bank.id} aria-haspopup="menu" aria-label={t("activityBanks.actions", { title: bank.title })} className="secondary icon-button" type="button" onClick={() => setActionMenuId((current) => current === bank.id ? null : bank.id)}><MoreIcon /></button>
                      {actionMenuId === bank.id ? <div className="content-header-menu content-context-menu" role="menu"><button className="content-context-menu-item" role="menuitem" type="button" onClick={() => openEdit(bank)}><EditIcon /><span>{t("common.edit")}</span></button><button className="content-context-menu-item is-danger" role="menuitem" type="button" onClick={() => openDelete(bank)}><RemoveIcon /><span>{t("common.remove")}</span></button></div> : null}
                    </div>
                  ) : <span />}
                </div>
              ))}
            </div>
          ) : <p className="muted">{t("activityBanks.empty")}</p>}
        </section>

        {editorBank !== undefined ? (
          <div className="dialog-backdrop" role="presentation"><section aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="bank-editor-title">
            <div className="section-heading"><div><p className="eyebrow">{t("activityBanks.eyebrow")}</p><h2 id="bank-editor-title">{editorBank ? t("activityBanks.editTitle") : t("activityBanks.addTitle")}</h2></div><button className="secondary icon-button" type="button" onClick={() => setEditorBank(undefined)} title={t("common.close")}><CloseIcon /></button></div>
            <form className="form" onSubmit={saveActivityBank}>
              <div className={`field ${editorBank?.activities?.length ? "field-readonly" : ""}`}><label htmlFor="bank-subject">{t("activityBanks.subjectLabel")}</label><select id="bank-subject" value={draft.subjectId} disabled={Boolean(editorBank?.activities?.length)} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })} required>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}</select>{editorBank?.activities?.length ? <p className="muted">{t("activityBanks.subjectLockedHelp")}</p> : null}</div>
              <div className="field"><label htmlFor="bank-title">{t("activityBanks.titleLabel")}</label><input id="bank-title" minLength={2} maxLength={160} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
              <div className="field"><label htmlFor="bank-description">{t("activityBanks.descriptionLabel")}</label><textarea id="bank-description" maxLength={4000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
              <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setEditorBank(undefined)}>{t("common.cancel")}</button><button disabled={saving || !draft.subjectId} type="submit">{saving ? t("common.saving") : t("common.save")}</button></div>
            </form>
          </section></div>
        ) : null}

        {deleteState?.step === "options" ? (
          <div className="dialog-backdrop" role="presentation"><section aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="bank-delete-options-title">
            <div><p className="eyebrow">{t("activityBanks.deleteEyebrow")}</p><h2 id="bank-delete-options-title">{t("activityBanks.deleteTitle")}</h2></div>
            <p>{t("activityBanks.deletePopulatedMessage", { title: deleteState.bank.title, count: deleteState.bank.activities?.length ?? 0 })}</p>
            <form className="form" onSubmit={submitDeleteOptions}>
              <label className="checkbox-row"><input type="radio" name="delete-mode" checked={deleteState.mode === "move"} onChange={() => setDeleteState({ ...deleteState, mode: "move" })} /><span>{t("activityBanks.moveActivities")}</span></label>
              {deleteState.mode === "move" ? <div className="field"><label htmlFor="destination-bank">{t("activityBanks.destinationLabel")}</label><select id="destination-bank" required value={deleteState.targetId} onChange={(event) => setDeleteState({ ...deleteState, targetId: event.target.value })}><option value="">{t("activityBanks.chooseDestination")}</option>{moveTargets.map((bank) => <option key={bank.id} value={bank.id}>{bank.title}</option>)}</select>{!moveTargets.length ? <p className="muted">{t("activityBanks.noMoveTargets")}</p> : null}</div> : null}
              <label className="checkbox-row"><input type="radio" name="delete-mode" checked={deleteState.mode === "delete"} onChange={() => setDeleteState({ ...deleteState, mode: "delete" })} /><span>{t("activityBanks.deleteAllActivities")}</span></label>
              <div className="dialog-actions"><button className="secondary" type="button" onClick={() => setDeleteState(null)}>{t("common.cancel")}</button><button disabled={saving || (deleteState.mode === "move" && !deleteState.targetId)} className={deleteState.mode === "delete" ? "danger" : ""} type="submit">{saving ? t("common.saving") : t("activityBanks.continueLabel")}</button></div>
            </form>
          </section></div>
        ) : null}

        <ConfirmationDialog open={deleteState?.step === "confirm-delete"} eyebrow={t("activityBanks.deleteEyebrow")} title={t("activityBanks.deleteTitle")} message={deleteState && (deleteState.bank.activities?.length ?? 0) > 0 ? t("activityBanks.deleteAllConfirm", { title: deleteState.bank.title, count: deleteState.bank.activities?.length ?? 0 }) : t("activityBanks.deleteEmptyConfirm", { title: deleteState?.bank.title ?? "" })} confirmLabel={t("activityBanks.deleteConfirmLabel")} cancelLabel={t("common.cancel")} confirmVariant="danger" isConfirming={saving} onCancel={() => setDeleteState(null)} onConfirm={() => performDelete({ action: "delete", force: Boolean(deleteState?.bank.activities?.length) })} />
      </main>
    </AppShell>
  );
}

function MoreIcon() { return <AppIcon name="more" size={20} />; }
function EditIcon() { return <AppIcon name="edit" />; }
function RemoveIcon() { return <AppIcon name="remove" />; }
function CloseIcon() { return <AppIcon name="close" />; }
