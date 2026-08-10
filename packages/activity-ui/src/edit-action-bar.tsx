import React, { type ReactNode } from "react";

type EditActionBarProps = {
  isDirty: boolean;
  isSaving?: boolean;
  savedLabel: string;
  unsavedLabel: string;
  saveLabel: string;
  savingLabel: string;
  cancelLabel: string;
  onCancel?: () => void;
  cancelHref?: string;
  onSave?: () => void;
  form?: string;
  saveDisabled?: boolean;
  secondaryActions?: ReactNode;
  className?: string;
};

const editActionBarCopy = {
  en: { cancel: "Cancel", save: "Save", saved: "Everything is saved.", saving: "Saving...", unsaved: "You have unsaved changes." },
  fr: { cancel: "Annuler", save: "Enregistrer", saved: "Tout est enregistré.", saving: "Enregistrement...", unsaved: "Vous avez des modifications non enregistrées." },
  zh: { cancel: "取消", save: "保存", saved: "所有内容均已保存。", saving: "保存中...", unsaved: "你有未保存的更改。" },
  ar: { cancel: "إلغاء", save: "حفظ", saved: "تم حفظ كل شيء.", saving: "جار الحفظ...", unsaved: "لديك تغييرات غير محفوظة." }
} as const;

export function getEditActionBarCopy(locale?: string) {
  return editActionBarCopy[locale as keyof typeof editActionBarCopy] ?? editActionBarCopy.en;
}

export function EditActionBar({
  isDirty,
  isSaving = false,
  savedLabel,
  unsavedLabel,
  saveLabel,
  savingLabel,
  cancelLabel,
  onCancel,
  cancelHref,
  onSave,
  form,
  saveDisabled = false,
  secondaryActions,
  className = ""
}: EditActionBarProps) {
  const cancelControl = cancelHref ? (
    <a className="button secondary" href={cancelHref}>{cancelLabel}</a>
  ) : (
    <button className="button secondary" disabled={isSaving || !isDirty} type="button" onClick={onCancel}>
      {cancelLabel}
    </button>
  );

  return (
    <div className={`edit-action-bar${className ? ` ${className}` : ""}`}>
      <p className="muted edit-action-bar-status" aria-live="polite">
        {isDirty ? unsavedLabel : savedLabel}
      </p>
      <div className="edit-action-bar-actions">
        {secondaryActions}
        {cancelControl}
        <button
          type={form ? "submit" : "button"}
          form={form}
          disabled={isSaving || !isDirty || saveDisabled}
          onClick={form ? undefined : onSave}
        >
          {isSaving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
