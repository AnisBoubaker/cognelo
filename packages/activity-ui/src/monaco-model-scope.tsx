"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { editor } from "monaco-editor";

/** One mounted editing session. Never persisted or shared across attempts/accounts. */
export class MonacoModelStore {
  private readonly namespace = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  private readonly models = new Set<editor.ITextModel>();
  private readonly views = new Map<string, editor.ICodeEditorViewState>();
  private generation = 0;

  path(group: string, document: string) {
    // Monaco decodes URI paths once; keep slashes inside identifiers opaque.
    return `inmemory://cognelo/${this.namespace}/${encodeURIComponent(encodeURIComponent(group))}/${encodeURIComponent(encodeURIComponent(document))}`;
  }
  remember(model: editor.ITextModel) { this.models.add(model); }
  saveView(path: string, view: editor.ICodeEditorViewState | null) { if (view) this.views.set(path, view); }
  view(path: string) { return this.views.get(path); }
  retain() { return ++this.generation; }
  release(generation: number) {
    // React Strict Mode can immediately reactivate a scope. Dispose only after
    // its editors detach, and cancel disposal when the same scope reactivates.
    queueMicrotask(() => {
      if (generation !== this.generation) return;
      for (const model of this.models) if (!model.isDisposed()) model.dispose();
      this.models.clear();
      this.views.clear();
    });
  }
}

const MonacoModelContext = createContext<{ store: MonacoModelStore; group: string } | null>(null);

export function useMonacoModelStore() {
  const inherited = useContext(MonacoModelContext);
  const [local] = useState(() => new MonacoModelStore());
  useEffect(() => {
    const generation = local.retain();
    return () => local.release(generation);
  }, [local]);
  return inherited ?? { store: local, group: "" };
}

/** Key this provider by attempt/view; unmount it on navigation, logout or closure. */
export function MonacoModelScope({ children }: { children: ReactNode }) {
  const [store] = useState(() => new MonacoModelStore());
  useEffect(() => {
    const generation = store.retain();
    return () => store.release(generation);
  }, [store]);
  const value = useMemo(() => ({ store, group: "" }), [store]);
  return <MonacoModelContext.Provider value={value}>{children}</MonacoModelContext.Provider>;
}

/** File identifiers may be identical in different Test questions. */
export function MonacoModelGroup({ id, children }: { id: string; children: ReactNode }) {
  const parent = useContext(MonacoModelContext);
  const value = useMemo(() => parent ? { ...parent, group: `${parent.group}/${id}` } : null, [parent, id]);
  return <MonacoModelContext.Provider value={value}>{children}</MonacoModelContext.Provider>;
}
