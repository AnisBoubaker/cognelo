"use client";

import { useEffect } from "react";

const locks = new WeakMap<HTMLElement, { count: number; overflow: string }>();

/** Keep the original overflow until the last overlapping owner releases its lock. */
export function acquireBodyScrollLock(body: HTMLElement) {
  const state = locks.get(body) ?? { count: 0, overflow: body.style.overflow };
  state.count += 1;
  locks.set(body, state);
  body.style.overflow = "hidden";

  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count -= 1;
    if (state.count === 0) {
      body.style.overflow = state.overflow;
      locks.delete(body);
    }
  };
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) return acquireBodyScrollLock(document.body);
  }, [locked]);
}
