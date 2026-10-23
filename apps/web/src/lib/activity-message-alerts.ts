import type { ActivityMessagingStatus } from "./api";

/** Initial/backlog snapshots, read receipts, teacher sends and repeated polls stay quiet. */
export function newStudentMessageCount(previous: ActivityMessagingStatus | null, current: ActivityMessagingStatus) {
  if (!previous?.enabled || !current.enabled || !current.latestStudentMessage) return 0;
  const next = current.latestStudentMessage, old = previous.latestStudentMessage;
  if (old && (next.id === old.id || next.createdAt < old.createdAt || (next.createdAt === old.createdAt && next.id <= old.id))) return 0;
  return Math.max(1, current.studentMessageCount - previous.studentMessageCount);
}

export function messageSoundStorageKey(userId: string) { return `cognelo:activity-message-sound-muted:${userId}`; }

/** One short local chime; no audio file, network request, or deferred autoplay queue. */
export function createActivityMessageSound(createContext: () => AudioContext, onReady: (ready: boolean) => void) {
  let context: AudioContext | null = null;
  let disposed = false;
  const playing = new Set<OscillatorNode>();
  function stop() {
    for (const oscillator of playing) { try { oscillator.stop(); } catch { /* Already ended. */ } }
    playing.clear();
  }
  return {
    unlock() {
      if (disposed) return;
      try {
        context ??= createContext();
        const current = context;
        current.onstatechange = () => { if (!disposed) onReady(current.state === "running"); };
        if (current.state !== "running") void current.resume().catch(() => { if (!disposed) onReady(false); });
        onReady(current.state === "running");
      } catch { onReady(false); }
    },
    play() {
      if (disposed || context?.state !== "running") return false;
      try {
        stop();
        const start = context.currentTime;
        [880, 1174.66].forEach((frequency, index) => {
          const oscillator = context!.createOscillator();
          const gain = context!.createGain();
          const at = start + index * 0.14;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, at);
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(0.12, at + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
          oscillator.connect(gain); gain.connect(context!.destination);
          oscillator.onended = () => { playing.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
          playing.add(oscillator);
          oscillator.start(at); oscillator.stop(at + 0.2);
        });
        return true;
      } catch { stop(); return false; }
    },
    stop,
    dispose() {
      disposed = true; stop();
      if (context) { context.onstatechange = null; void context.close().catch(() => undefined); context = null; }
    }
  };
}
