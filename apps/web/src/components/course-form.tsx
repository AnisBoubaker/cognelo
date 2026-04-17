"use client";

import { FormEvent, useState } from "react";
import type { CourseInput } from "@cognara/contracts";
import type { Course } from "@/lib/api";

type Props = {
  initial?: Pick<Course, "title" | "description" | "status">;
  submitLabel: string;
  onSubmit: (input: CourseInput) => Promise<void>;
};

export function CourseForm({ initial, submitLabel, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ title, description, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save course.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="status">Publication status</label>
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
