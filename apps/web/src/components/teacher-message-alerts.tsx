"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNotifications } from "@cognelo/activity-ui";
import { AppIcon } from "@/components/app-icon";
import { useI18n } from "@/lib/i18n";
import type { ActivityMessagingStatus } from "@/lib/api";
import { createActivityMessageSound, messageSoundStorageKey, newStudentMessageCount } from "@/lib/activity-message-alerts";

type SoundControl = { enabled: boolean; supported: boolean; toggle: () => void; unreadCount: number };
export const TeacherMessageAlertContext = createContext<SoundControl | null>(null);

export function TeacherMessageUnreadBadge() {
  const alerts = useContext(TeacherMessageAlertContext);
  const { t } = useI18n();
  if (!alerts?.unreadCount) return null;
  return <span className="activity-message-count" role="status" aria-label={t("activityMessenger.unreadStudentMessages", { count: alerts.unreadCount })}>
    {alerts.unreadCount > 99 ? "99+" : alerts.unreadCount}
  </span>;
}

export function TeacherMessageSoundToggle() {
  const sound = useContext(TeacherMessageAlertContext);
  const { t } = useI18n();
  if (!sound) return null;
  return <button className="secondary icon-button activity-chat-sound-toggle" type="button" data-message-sound-toggle
    aria-label={t("activityMessenger.soundNotifications")} aria-pressed={sound.enabled} disabled={!sound.supported}
    title={t(!sound.supported ? "activityMessenger.soundUnavailable" : sound.enabled ? "activityMessenger.muteSound" : "activityMessenger.enableSound")}
    onClick={sound.toggle}><AppIcon name={sound.enabled ? "soundOn" : "soundOff"} /></button>;
}

export function useTeacherMessageAlerts(userId: string | undefined, scope: string, active: boolean) {
  const notifications = useNotifications();
  const { t } = useI18n();
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const mutedRef = useRef(false);
  const soundRef = useRef<ReturnType<typeof createActivityMessageSound> | null>(null);
  const previousRef = useRef<ActivityMessagingStatus | null>(null);
  const outputRef = useRef({ notifications, t }); outputRef.current = { notifications, t };

  useEffect(() => { previousRef.current = null; }, [scope, userId, active]);
  useEffect(() => {
    setReady(false);
    if (!active || !userId) return;
    const key = messageSoundStorageKey(userId);
    const readPreference = () => {
      try { mutedRef.current = localStorage.getItem(key) === "true"; } catch { mutedRef.current = false; }
      setMuted(mutedRef.current);
    };
    readPreference();
    const Audio = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    setSupported(Boolean(Audio));
    const sound = Audio ? createActivityMessageSound(() => new Audio(), setReady) : null;
    soundRef.current = sound;
    const unlock = (event: Event) => {
      if (mutedRef.current || (event.target instanceof Element && event.target.closest("[data-message-sound-toggle]"))) return;
      sound?.unlock();
    };
    const preferenceChanged = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      readPreference();
      if (mutedRef.current) sound?.stop();
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    window.addEventListener("storage", preferenceChanged);
    if (!mutedRef.current && navigator.userActivation?.hasBeenActive) sound?.unlock();
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      window.removeEventListener("storage", preferenceChanged);
      soundRef.current = null; sound?.dispose();
    };
  }, [active, userId]);

  const toggle = useCallback(() => {
    const nextMuted = !mutedRef.current && ready;
    mutedRef.current = nextMuted; setMuted(nextMuted);
    if (userId) { try { localStorage.setItem(messageSoundStorageKey(userId), String(nextMuted)); } catch { /* The control remains usable without storage. */ } }
    if (nextMuted) soundRef.current?.stop(); else soundRef.current?.unlock();
  }, [ready, userId]);

  const acceptStatus = useCallback((status: ActivityMessagingStatus) => {
    const count = newStudentMessageCount(previousRef.current, status);
    previousRef.current = status;
    if (!count) return;
    const { notifications: notify, t: translate } = outputRef.current;
    notify.info(count === 1
      ? translate("activityMessenger.newMessageFrom", { name: status.latestStudentMessage!.senderName })
      : translate("activityMessenger.newMessages", { count }), { title: translate("activityMessenger.newMessageTitle"), durationMs: 8000 });
    if (!mutedRef.current) soundRef.current?.play();
  }, []);

  return { acceptStatus, sound: { enabled: !muted && ready, supported, toggle }, needsInteraction: !muted && !ready && supported };
}
