"use client";
import { useState } from "react";
import { CodeRenderer } from "@cognelo/activity-ui";
import { readCodingSourceFiles } from "../coding-files";
import { CodingFileTabs } from "./coding-file-tabs";
import { normalizeCodingExercisesLocale } from "./messages";

export function CodingFilesView({ files: value, sourceCode, language, locale }: {
  files?: unknown; sourceCode: string; language: string; locale?: string;
}) {
  const files = readCodingSourceFiles(value);
  const [selectedId, setSelectedId] = useState("");
  const selected = files?.find(file => file.id === selectedId) ?? files?.[0];
  return <div className="stack stack-tight">
    {files && files.length > 1 ? <CodingFileTabs files={files} selected={selected!.id} onSelect={setSelectedId} locale={normalizeCodingExercisesLocale(locale)} /> : null}
    <CodeRenderer code={selected?.sourceCode ?? sourceCode} language={language} showLineNumbers />
  </div>;
}
