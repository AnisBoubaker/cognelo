"use client";

import { useEffect, useState } from "react";

export function remainingServerSeconds(seconds: number | null, receivedAt: number, now: number) {
  return seconds === null ? null : Math.max(0, Math.ceil(seconds - Math.max(0, now - receivedAt) / 1000));
}

/** Anchor every server response to elapsed time, never the device's wall clock. */
export function useServerCountdown(timing: { remainingSeconds: number | null } | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(timing?.remainingSeconds ?? null);
  useEffect(() => {
    const seconds = timing?.remainingSeconds ?? null;
    const receivedAt = performance.now();
    const update = () => setRemaining(remainingServerSeconds(seconds, receivedAt, performance.now()));
    update();
    if (seconds === null) return;
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [timing]);
  return remaining;
}
