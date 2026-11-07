"use client";
import { createContext, useContext, type ReactNode } from "react";
export type ActivityReferenceAuthoringState = { loaded: boolean; selectedCount?: number; dirty: boolean; prepared: boolean; revision: string };
const Context = createContext<ActivityReferenceAuthoringState | null>(null);
export function ActivityReferenceAuthoringProvider({ value, children }: { value: ActivityReferenceAuthoringState | null; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useActivityReferenceAuthoring() { return useContext(Context); }
