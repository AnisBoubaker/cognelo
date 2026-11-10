"use client";
import React from "react";
const messages: Record<string, string> = {
  en: "Awaiting teacher activation",
  fr: "En attente de l’activation par l’enseignant",
  zh: "等待教师开放",
  ar: "بانتظار تفعيل المدرّس"
};
/** Persistent workflow state, separate from transient notifications or background processing. */
export function SubmissionStageWaiting({ locale = "en" }: { locale?: string }) {
  return <p role="status" className="muted">{messages[locale] ?? messages.en}</p>;
}
