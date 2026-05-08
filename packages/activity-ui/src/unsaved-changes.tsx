"use client";

import { createContext, useContext, useEffect, useRef } from "react";

export type UnsavedChangesGuard = {
  isDirty: boolean;
  onSave: () => Promise<void>;
  onDiscard?: () => void;
};

export type UnsavedChangesContextValue = {
  registerGuard: (id: string, guard: UnsavedChangesGuard) => () => void;
  updateGuard: (id: string, guard: UnsavedChangesGuard) => void;
};

export const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function useUnsavedChangesGuard(guard: UnsavedChangesGuard) {
  const context = useContext(UnsavedChangesContext);
  const idRef = useRef(`unsaved-${Math.random().toString(36).slice(2)}`);
  const guardRef = useRef(guard);
  const proxyRef = useRef<UnsavedChangesGuard>({
    get isDirty() {
      return guardRef.current.isDirty;
    },
    onSave: () => guardRef.current.onSave(),
    onDiscard: () => guardRef.current.onDiscard?.()
  });

  guardRef.current = guard;

  useEffect(() => {
    if (!context) {
      return;
    }
    return context.registerGuard(idRef.current, proxyRef.current);
  }, [context]);

  useEffect(() => {
    context?.updateGuard(idRef.current, proxyRef.current);
  }, [context, guard.isDirty]);
}
