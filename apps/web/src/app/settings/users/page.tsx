"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications, useUnsavedChangesGuard } from "@cognelo/activity-ui";
import { AppShell } from "@/components/app-shell";
import { AppIcon } from "@/components/app-icon";
import { useAuth } from "@/components/auth-provider";
import { SettingsNav } from "@/components/settings-nav";
import { api, type AdminRole, type AdminUser, type AdminUserFilters, type Pagination } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type UserDraft = { email: string; firstName: string; lastName: string; password: string; roles: AdminRole["key"][] };
const emptyDraft: UserDraft = { email: "", firstName: "", lastName: "", password: "", roles: [] };

export default function UserSettingsPage() {
  const { user: currentUser } = useAuth();
  const { t } = useI18n();
  const notifications = useNotifications();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [filters, setFilters] = useState<AdminUserFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<AdminUserFilters>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null | undefined>(undefined);
  const [draft, setDraft] = useState<UserDraft>(emptyDraft);
  const [savedDraft, setSavedDraft] = useState<UserDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<AdminUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("");
  const [passwordResetError, setPasswordResetError] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const isAdmin = currentUser?.roles.includes("admin") ?? false;

  const loadUsers = useCallback(async (nextFilters: AdminUserFilters, page: number, pageSize: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.users(nextFilters, { page, pageSize });
      setUsers(result.users);
      setRoles(result.roles);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.usersLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) void loadUsers(appliedFilters, pagination.page, pagination.pageSize);
    else setLoading(false);
  }, [appliedFilters, isAdmin, loadUsers, pagination.page, pagination.pageSize]);

  const hasUnsavedChanges = editingUser !== undefined && JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const closeEditor = useCallback(() => {
    setEditingUser(undefined);
    setDraft(emptyDraft);
    setSavedDraft(emptyDraft);
  }, []);

  useUnsavedChangesGuard(useMemo(() => ({
    isDirty: hasUnsavedChanges,
    onSave: async () => { throw new Error(t("settings.finishUserEditFirst")); },
    onDiscard: closeEditor
  }), [closeEditor, hasUnsavedChanges, t]));

  function openCreate() {
    setEditingUser(null);
    setDraft(emptyDraft);
    setSavedDraft(emptyDraft);
  }

  function openEdit(user: AdminUser) {
    const next = { email: user.email, firstName: user.firstName ?? "", lastName: user.lastName ?? "", password: "", roles: user.roles.map((role) => role.key) };
    setEditingUser(user);
    setDraft(next);
    setSavedDraft(next);
  }

  function toggleRole(role: AdminRole["key"], checked: boolean) {
    setDraft((current) => ({ ...current, roles: checked ? [...new Set([...current.roles, role])] : current.roles.filter((key) => key !== role) }));
  }

  function openPasswordReset(user: AdminUser) {
    setPasswordResetUser(user);
    setTemporaryPassword("");
    setConfirmTemporaryPassword("");
    setPasswordResetError("");
  }

  const closePasswordReset = useCallback(() => {
    setPasswordResetUser(null);
    setTemporaryPassword("");
    setConfirmTemporaryPassword("");
    setPasswordResetError("");
  }, []);

  const hasUnsavedPasswordReset = Boolean(passwordResetUser && (temporaryPassword || confirmTemporaryPassword));
  useUnsavedChangesGuard(useMemo(() => ({
    isDirty: hasUnsavedPasswordReset,
    onSave: async () => { throw new Error(t("settings.finishPasswordResetFirst")); },
    onDiscard: closePasswordReset
  }), [closePasswordReset, hasUnsavedPasswordReset, t]));

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!passwordResetUser) return;
    if (temporaryPassword !== confirmTemporaryPassword) {
      setPasswordResetError(t("settings.passwordMismatch"));
      return;
    }
    setResettingPassword(true);
    setPasswordResetError("");
    try {
      await api.resetUserPassword(passwordResetUser.id, { password: temporaryPassword, confirmPassword: confirmTemporaryPassword });
      notifications.success(t("settings.adminPasswordResetSuccess", { name: passwordResetUser.name ?? passwordResetUser.email }));
      closePasswordReset();
      await loadUsers(appliedFilters, pagination.page, pagination.pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.adminPasswordResetError");
      setPasswordResetError(message);
      notifications.error(message);
    } finally {
      setResettingPassword(false);
    }
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!draft.roles.length) {
      setError(t("settings.userRoleRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, { email: draft.email, firstName: draft.firstName, lastName: draft.lastName, roles: draft.roles });
        notifications.success(t("settings.userUpdated"));
      } else {
        await api.createUser(draft);
        notifications.success(t("settings.userCreated"));
      }
      closeEditor();
      await loadUsers(appliedFilters, pagination.page, pagination.pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.userSaveError");
      setError(message);
      notifications.error(message);
    } finally {
      setSaving(false);
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(filters);
  }

  return (
    <AppShell>
      <main className="page stack">
        <section className="hero-panel hero-panel-compact"><div className="hero-meta"><p className="eyebrow">{t("settings.eyebrow")}</p><h1>{t("settings.title")}</h1><p className="muted">{t("settings.subtitle")}</p></div></section>
        <div className="settings-layout">
          <SettingsNav />
          <section className="section stack">
            <div className="section-heading"><div><p className="eyebrow">{t("settings.usersEyebrow")}</p><h2>{t("settings.usersTitle")}</h2></div>{isAdmin ? <button type="button" onClick={openCreate}>{t("settings.addUser")}</button> : null}</div>
            {!isAdmin ? <p className="muted">{t("settings.usersAdminOnly")}</p> : (
              <>
                <form className="form inline-panel user-filter-form" onSubmit={applyFilters}>
                  <div className="field"><label htmlFor="user-filter-role">{t("settings.filterRole")}</label><select id="user-filter-role" value={filters.role ?? ""} onChange={(event) => setFilters({ ...filters, role: event.target.value || undefined })}><option value="">{t("settings.allRoles")}</option>{roles.map((role) => <option key={role.id} value={role.key}>{t(`roles.${role.key}`)}</option>)}</select></div>
                  <div className="field"><label htmlFor="user-filter-first-name">{t("settings.firstName")}</label><input id="user-filter-first-name" value={filters.firstName ?? ""} onChange={(event) => setFilters({ ...filters, firstName: event.target.value })} /></div>
                  <div className="field"><label htmlFor="user-filter-last-name">{t("settings.lastName")}</label><input id="user-filter-last-name" value={filters.lastName ?? ""} onChange={(event) => setFilters({ ...filters, lastName: event.target.value })} /></div>
                  <div className="field"><label htmlFor="user-filter-email">{t("settings.email")}</label><input id="user-filter-email" type="search" value={filters.email ?? ""} onChange={(event) => setFilters({ ...filters, email: event.target.value })} /></div>
                  <div className="row"><button type="submit">{t("settings.applyFilters")}</button><button className="secondary" type="button" onClick={() => { setFilters({}); setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters({}); }}>{t("settings.clearFilters")}</button></div>
                </form>
                {error ? <p className="error">{error}</p> : null}
                {loading ? <p className="muted">{t("common.loading")}</p> : users.length ? (
                  <div className="table-list user-settings-list">
                    <div className="table-row table-row-users table-head" aria-hidden="true"><span>{t("settings.userName")}</span><span>{t("settings.email")}</span><span>{t("settings.roles")}</span><span /></div>
                    {users.map((user) => <div className="table-row table-row-users" key={user.id}><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span><div className="metadata-badges">{user.roles.map((role) => <span className="metadata-badge" key={role.key}>{t(`roles.${role.key}`)}</span>)}{user.mustChangePassword ? <span className="metadata-badge">{t("settings.passwordChangeRequiredBadge")}</span> : null}</div><div className="row"><button className="secondary" type="button" onClick={() => openEdit(user)}>{t("common.edit")}</button><button className="secondary" disabled={user.id === currentUser?.id} title={user.id === currentUser?.id ? t("settings.adminPasswordResetSelfHelp") : undefined} type="button" onClick={() => openPasswordReset(user)}>{t("settings.adminPasswordResetAction")}</button></div></div>)}
                  </div>
                ) : <p className="muted">{t("settings.usersEmpty")}</p>}
                {!loading && pagination.total > 0 ? <nav className="pagination-bar" aria-label={t("settings.usersPaginationLabel")}><div className="pagination-controls"><button className="secondary" type="button" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>{t("settings.previousPage")}</button>{paginationItems(pagination.page, pagination.totalPages).map((item, index) => item === "ellipsis" ? <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button className={item === pagination.page ? "pagination-page is-active" : "secondary pagination-page"} type="button" aria-current={item === pagination.page ? "page" : undefined} key={item} onClick={() => setPagination((current) => ({ ...current, page: item }))}>{item}</button>)}<button className="secondary" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>{t("settings.nextPage")}</button></div><label className="pagination-size"><span>{t("settings.usersPerPage")}</span><select value={pagination.pageSize} onChange={(event) => setPagination((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) }))}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label></nav> : null}
              </>
            )}
          </section>
        </div>
        {editingUser !== undefined ? <div className="dialog-backdrop" role="presentation"><section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="user-editor-title"><div className="section-heading"><div><p className="eyebrow">{t("settings.userEyebrow")}</p><h2 id="user-editor-title">{editingUser ? t("settings.editUser") : t("settings.addUser")}</h2></div><button className="secondary icon-button" type="button" title={t("common.close")} onClick={closeEditor}><CloseIcon /></button></div><form className="form" onSubmit={saveUser}><div className="form-grid-two"><div className="field"><label htmlFor="user-first-name">{t("settings.firstName")}</label><input id="user-first-name" required maxLength={120} value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} /></div><div className="field"><label htmlFor="user-last-name">{t("settings.lastName")}</label><input id="user-last-name" required maxLength={120} value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></div></div><div className="field"><label htmlFor="user-email">{t("settings.email")}</label><input id="user-email" required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></div>{!editingUser ? <div className="field"><label htmlFor="user-password">{t("settings.initialPassword")}</label><input id="user-password" required minLength={8} type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /><p className="muted">{t("settings.initialPasswordHelp")}</p></div> : null}<fieldset className="field role-fieldset"><legend>{t("settings.roles")}</legend>{roles.map((role) => { const locksOwnAdmin = editingUser?.id === currentUser?.id && role.key === "admin"; return <label className="checkbox-row" key={role.id}><input type="checkbox" checked={draft.roles.includes(role.key)} disabled={locksOwnAdmin} onChange={(event) => toggleRole(role.key, event.target.checked)} /><span>{t(`roles.${role.key}`)}</span></label>; })}<p className="muted">{t("settings.rolesHelp")}</p></fieldset>{error ? <p className="error">{error}</p> : null}<div className="dialog-actions"><button className="secondary" type="button" onClick={closeEditor}>{t("common.cancel")}</button><button disabled={saving} type="submit">{saving ? t("common.saving") : t("common.save")}</button></div></form></section></div> : null}
        {passwordResetUser ? <div className="dialog-backdrop" role="presentation"><section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="password-reset-title"><div className="section-heading"><div><p className="eyebrow">{t("settings.passwordEyebrow")}</p><h2 id="password-reset-title">{t("settings.adminPasswordResetTitle", { name: passwordResetUser.name ?? passwordResetUser.email })}</h2><p className="muted">{t("settings.adminPasswordResetHelp")}</p></div><button className="secondary icon-button" type="button" title={t("common.close")} onClick={closePasswordReset}><CloseIcon /></button></div><form className="form" onSubmit={resetPassword}><div className="field"><label htmlFor="temporary-password">{t("settings.temporaryPassword")}</label><input autoComplete="new-password" id="temporary-password" maxLength={200} minLength={8} required type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /></div><div className="field"><label htmlFor="confirm-temporary-password">{t("settings.confirmTemporaryPassword")}</label><input autoComplete="new-password" id="confirm-temporary-password" maxLength={200} minLength={8} required type="password" value={confirmTemporaryPassword} onChange={(event) => setConfirmTemporaryPassword(event.target.value)} /></div><p className="muted">{t("settings.adminPasswordResetConsequence")}</p>{passwordResetError ? <p className="error" role="alert">{passwordResetError}</p> : null}<div className="dialog-actions"><button className="secondary" type="button" onClick={closePasswordReset}>{t("common.cancel")}</button><button disabled={resettingPassword} type="submit">{resettingPassword ? t("settings.resettingPassword") : t("settings.adminPasswordResetSubmit")}</button></div></form></section></div> : null}
      </main>
    </AppShell>
  );
}

function CloseIcon() {
  return <AppIcon name="close" />;
}

function paginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1].filter((page) => page >= 1 && page <= totalPages));
  const sorted = [...pages].sort((left, right) => left - right);
  return sorted.flatMap((page, index) => index > 0 && page - sorted[index - 1] > 1 ? ["ellipsis", page] : [page]);
}
