"use client";
import { useState, type KeyboardEvent } from "react";
import { ActionIcon, codeInputProtectionAttributes } from "@cognelo/activity-ui";
import { formatCodingExercisesMessage, type CodingExercisesLocale } from "./messages";

type File = { id: string; name: string };
export function CodingFileTabs({ files, selected, onSelect, onAdd, onRename, onRemove, locale }: {
  files: File[]; selected: string; onSelect: (id: string) => void; locale: CodingExercisesLocale;
  onAdd?: (name: string) => boolean; onRename?: (id: string, name: string) => boolean; onRemove?: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState("");
  const t = (key: Parameters<typeof formatCodingExercisesMessage>[1], values?: Record<string, string | number>) => formatCodingExercisesMessage(locale, key, values);
  function commit() {
    if (editing === null) return;
    const accepted = editing === "__new__" ? onAdd?.(name) : onRename?.(editing, name);
    if (accepted) setEditing(null);
  }
  function inputKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); commit(); }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setEditing(null); }
  }
  return <div className="coding-file-tabs" role="tablist" aria-label={t("sourceFiles")} onKeyDown={event => {
    if ((event.target as HTMLElement).getAttribute("role") !== "tab" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const current = files.findIndex(file => file.id === selected);
    const next = event.key === "Home" ? 0 : event.key === "End" ? files.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + files.length) % files.length;
    event.preventDefault(); onSelect(files[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }}>
    {files.map((file, index) => <div key={file.id} className={`coding-file-tab${file.id === selected ? " is-active" : ""}`}>
      {editing === file.id ? <input {...codeInputProtectionAttributes} autoFocus aria-label={t("renameFile", { name: file.name })} maxLength={80} value={name}
        onChange={event => setName(event.target.value)} onKeyDown={inputKeys} onBlur={() => { if (name.trim()) commit(); }} />
        : <button type="button" role="tab" translate="no" aria-selected={selected === file.id} tabIndex={selected === file.id ? 0 : -1}
          onClick={() => onSelect(file.id)} title={file.name}><span className="notranslate" translate="no">{file.name}</span></button>}
      {onRename && editing !== file.id ? <button type="button" className="icon-button secondary" aria-label={t("renameFile", { name: file.name })}
        title={t("renameFile", { name: file.name })} onClick={() => { setName(file.name); setEditing(file.id); }}><ActionIcon name="edit" /></button> : null}
      {onRemove && index > 0 ? <button type="button" className="icon-button secondary" aria-label={t("removeFile", { name: file.name })}
        title={t("removeFile", { name: file.name })} onClick={() => onRemove(file.id)}><ActionIcon name="close" /></button> : null}
    </div>)}
    {editing === "__new__" ? <input {...codeInputProtectionAttributes} autoFocus aria-label={t("fileName")} placeholder={t("fileName")} maxLength={80} value={name}
      onChange={event => setName(event.target.value)} onKeyDown={inputKeys} onBlur={() => { if (name.trim()) commit(); }} /> : null}
    {onAdd ? <button type="button" className="icon-button secondary coding-file-add" disabled={editing !== null || files.length >= 20}
      aria-label={t("addFile")} title={t("addFile")} onClick={() => { setName(""); setEditing("__new__"); }}><ActionIcon name="add" /></button> : null}
  </div>;
}
