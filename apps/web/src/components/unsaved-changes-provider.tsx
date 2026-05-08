"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UnsavedChangesContext, type UnsavedChangesGuard } from "@cognelo/activity-ui";
import { useI18n } from "@/lib/i18n";

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [guards, setGuards] = useState<Record<string, UnsavedChangesGuard>>({});
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bypassNextNavigation = useRef(false);
  const currentHref = useRef("");

  const dirtyGuards = useMemo(() => Object.values(guards).filter((guard) => guard.isDirty), [guards]);
  const hasDirtyGuards = dirtyGuards.length > 0;

  const registerGuard = useCallback((id: string, guard: UnsavedChangesGuard) => {
    setGuards((current) => ({ ...current, [id]: guard }));
    return () => {
      setGuards((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    };
  }, []);
  const updateGuard = useCallback((id: string, guard: UnsavedChangesGuard) => {
    setGuards((current) => {
      if (!current[id]) {
        return current;
      }
      return { ...current, [id]: guard };
    });
  }, []);
  const contextValue = useMemo(() => ({ registerGuard, updateGuard }), [registerGuard, updateGuard]);

  useEffect(() => {
    currentHref.current = window.location.href;
  }, [pathname]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasDirtyGuards) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDirtyGuards]);

  useEffect(() => {
    function handlePopState() {
      if (!hasDirtyGuards || bypassNextNavigation.current) {
        return;
      }

      const nextHref = window.location.href;
      window.history.pushState(null, "", currentHref.current);
      setPendingHref(nextHref);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasDirtyGuards]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!hasDirtyGuards || bypassNextNavigation.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.href === currentUrl.href) {
        return;
      }

      event.preventDefault();
      setPendingHref(nextUrl.href);
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasDirtyGuards]);

  async function saveAndLeave() {
    if (!pendingHref) {
      return;
    }
    setSaving(true);
    try {
      for (const guard of dirtyGuards) {
        await guard.onSave();
      }
      navigateToPendingHref();
    } finally {
      setSaving(false);
    }
  }

  function discardAndLeave() {
    for (const guard of dirtyGuards) {
      guard.onDiscard?.();
    }
    navigateToPendingHref();
  }

  function navigateToPendingHref() {
    if (!pendingHref) {
      return;
    }
    const nextUrl = new URL(pendingHref);
    const currentOrigin = window.location.origin;
    bypassNextNavigation.current = true;
    setPendingHref(null);
    if (nextUrl.origin === currentOrigin) {
      router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      window.setTimeout(() => {
        bypassNextNavigation.current = false;
      }, 0);
      return;
    }
    window.location.href = pendingHref;
  }

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      {children}
      {pendingHref ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="unsaved-dialog-title">
            <div className="stack">
              <div>
                <p className="eyebrow">{t("unsavedChanges.eyebrow")}</p>
                <h2 id="unsaved-dialog-title">{t("unsavedChanges.title")}</h2>
              </div>
              <p className="muted">{t("unsavedChanges.message")}</p>
              <div className="dialog-actions">
                <button className="secondary" type="button" disabled={saving} onClick={() => setPendingHref(null)}>
                  {t("unsavedChanges.continueEditing")}
                </button>
                <button type="button" disabled={saving} onClick={saveAndLeave}>
                  {saving ? t("common.saving") : t("unsavedChanges.saveAndLeave")}
                </button>
                <button className="secondary" type="button" disabled={saving} onClick={discardAndLeave}>
                  {t("unsavedChanges.discardAndLeave")}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}
