"use client";

import { AppIcon } from "@/components/app-icon";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApplicationTimeProvider, useApplicationTime } from "@cognelo/activity-ui";
import type { CourseTimeSettingsDto } from "@cognelo/contracts";
import { useAuth } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const CourseTimeContext = createContext<{
  courseId: string;
  settings: CourseTimeSettingsDto;
  setSettings: (settings: CourseTimeSettingsDto) => void;
} | null>(null);

export function useCourseTimeSettings() { return useContext(CourseTimeContext); }

export function CourseTimeProvider({ courseId, children }: { courseId: string; children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { now } = useApplicationTime();
  const { t } = useI18n();
  const [settings, setSettings] = useState<CourseTimeSettingsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const identity = `${courseId}:${userId ?? ""}`;
  const [loadedIdentity, setLoadedIdentity] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    api.courseTimeSettings(courseId).then((result) => {
      if (active) { setSettings(result); setLoadedIdentity(identity); setError(null); }
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "");
    });
    return () => { active = false; };
    // Keep open date forms in their loaded zone. Clock sync stays with AppTimeProvider.
  }, [courseId, identity, retry, userId]);

  const updateSettings = useCallback((value: CourseTimeSettingsDto) => setSettings(value), []);
  const timeValue = useMemo(() => ({ timeZone: settings?.timeZone ?? "UTC", now }), [settings?.timeZone, now]);
  const courseValue = useMemo(() => settings ? { courseId, settings, setSettings: updateSettings } : null, [courseId, settings, updateSettings]);
  if (!user) return <AppShell>{null}</AppShell>;
  if (!settings || loadedIdentity !== identity) return <AppShell><main className="page stack">
    <p role={error !== null ? "alert" : undefined}>{error !== null ? error || t("timeSettings.loadError") : t("common.loading")}</p>
    {error !== null ? <button onClick={() => { setError(null); setRetry((value) => value + 1); }}><AppIcon name="refresh" /> {t("common.retry")}</button> : null}
  </main></AppShell>;
  return <CourseTimeContext.Provider value={courseValue}><ApplicationTimeProvider value={timeValue}>{children}</ApplicationTimeProvider></CourseTimeContext.Provider>;
}
