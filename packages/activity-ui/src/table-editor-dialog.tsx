"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type TableEditorCopy = {
  eyebrow: string;
  title: string;
  help: string;
  rows: string;
  columns: string;
  cancel: string;
  insert: string;
  close: string;
};

export type TableEditorDialogProps = {
  copy: TableEditorCopy;
  onCancel: () => void;
  onConfirm: (value: { columns: number; rows: number }) => void;
};

const maximumRows = 20;
const maximumColumns = 12;

export function TableEditorDialog({ copy, onCancel, onConfirm }: TableEditorDialogProps) {
  const [rows, setRows] = useState("3");
  const [columns, setColumns] = useState("3");

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React events from portals still bubble through their component tree. Keep
    // this dialog's submit away from an authoring form that contains the editor.
    event.stopPropagation();
    onConfirm({
      columns: clampInteger(Number(columns), 1, maximumColumns),
      rows: clampInteger(Number(rows), 1, maximumRows)
    });
  }

  return createPortal(
    <div className="dialog-backdrop table-editor-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        aria-labelledby="table-editor-title"
        aria-modal="true"
        className="dialog-panel table-editor-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="section-heading table-editor-heading">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 id="table-editor-title">{copy.title}</h2>
            <p className="muted">{copy.help}</p>
          </div>
          <button aria-label={copy.close} className="secondary icon-button" type="button" onClick={onCancel}>×</button>
        </div>

        <div className="table-editor-size-fields">
          <label className="field">
            <span>{copy.rows}</span>
            <input
              autoFocus
              inputMode="numeric"
              max={maximumRows}
              min={1}
              type="number"
              value={rows}
              onChange={(event) => setRows(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{copy.columns}</span>
            <input
              inputMode="numeric"
              max={maximumColumns}
              min={1}
              type="number"
              value={columns}
              onChange={(event) => setColumns(event.target.value)}
            />
          </label>
        </div>

        <div className="dialog-actions table-editor-actions">
          <button className="secondary" type="button" onClick={onCancel}>{copy.cancel}</button>
          <button type="submit">{copy.insert}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function clampInteger(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
