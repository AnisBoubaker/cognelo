"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NotificationVariant = "success" | "error" | "info" | "warning";

type NotificationInput = {
  message: string;
  title?: string;
  variant?: NotificationVariant;
  durationMs?: number | null;
};

type NotificationRecord = NotificationInput & {
  createdAt: Date;
  id: number;
  variant: NotificationVariant;
};

export type NotificationLabels = Record<NotificationVariant, string> & {
  dismiss: string;
  history: string;
  historyTitle: string;
};

type NotificationsContextValue = {
  notify: (input: NotificationInput) => void;
  success: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  error: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  info: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  warning: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  dismiss: (id: number) => void;
};

const noop = () => {};

const NotificationsContext = createContext<NotificationsContextValue>({
  notify: noop,
  success: noop as NotificationsContextValue["success"],
  error: noop as NotificationsContextValue["error"],
  info: noop as NotificationsContextValue["info"],
  warning: noop as NotificationsContextValue["warning"],
  dismiss: noop as NotificationsContextValue["dismiss"]
});

const viewportStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  pointerEvents: "none" as const,
  position: "fixed" as const,
  right: 24,
  zIndex: 1000
};

const cardStyle = {
  background: "rgba(255, 255, 255, 0.96)",
  border: "1px solid rgba(13, 27, 71, 0.12)",
  borderRadius: 14,
  boxShadow: "0 18px 36px rgba(13, 27, 71, 0.16)",
  maxWidth: 360,
  minWidth: 280,
  padding: 14,
  pointerEvents: "auto" as const
};

const titleStyle = {
  color: "#0d1b47",
  fontSize: 15,
  fontWeight: 700,
  margin: 0
};

const messageStyle = {
  color: "#162148",
  lineHeight: 1.45,
  margin: 0
};

const closeButtonStyle = {
  background: "transparent",
  border: "none",
  boxShadow: "none",
  color: "#5e6988",
  cursor: "pointer",
  minHeight: "auto",
  padding: 0
};

const historyButtonStyle = {
  alignItems: "center",
  background: "#0d1b47",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  borderRadius: 999,
  bottom: 24,
  boxShadow: "0 14px 28px rgba(13, 27, 71, 0.22)",
  color: "#ffffff",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: 14,
  fontWeight: 700,
  gap: 8,
  minHeight: 44,
  padding: "0 16px",
  pointerEvents: "auto" as const,
  position: "fixed" as const,
  right: 24,
  zIndex: 1001
};

const historyPanelStyle = {
  background: "rgba(255, 255, 255, 0.98)",
  border: "1px solid rgba(13, 27, 71, 0.12)",
  borderRadius: 14,
  bottom: 82,
  boxShadow: "0 18px 44px rgba(13, 27, 71, 0.2)",
  display: "grid",
  gap: 10,
  maxHeight: "min(520px, calc(100vh - 120px))",
  maxWidth: 420,
  overflow: "auto" as const,
  padding: 14,
  pointerEvents: "auto" as const,
  position: "fixed" as const,
  right: 24,
  width: "min(420px, calc(100vw - 48px))",
  zIndex: 1001
};

const historyItemStyle = {
  border: "1px solid rgba(13, 27, 71, 0.1)",
  borderRadius: 10,
  display: "grid",
  gap: 6,
  padding: 10
};

const badgeStyle = {
  borderRadius: 999,
  color: "#ffffff",
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 700,
  padding: "2px 8px"
};

const metaStyle = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between"
};

const timeStyle = {
  color: "#5e6988",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums" as const
};

function getAccentColor(variant: NotificationVariant) {
  if (variant === "success") {
    return "#1f9d68";
  }
  if (variant === "error") {
    return "#b42318";
  }
  if (variant === "warning") {
    return "#b7791f";
  }
  return "#247fd6";
}

function getCurrentDocumentLocale() {
  if (typeof document !== "undefined") {
    return document.documentElement.lang || "en";
  }
  if (typeof navigator !== "undefined") {
    return navigator.language || "en";
  }
  return "en";
}

function formatNotificationTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale || "en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

export function NotificationProvider({ children, labels }: { children: ReactNode; labels: NotificationLabels }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [locale, setLocale] = useState("en");
  const nextIdRef = useRef(1);
  const timerIdsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const navigationClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCurrentPageNotifications = useCallback(() => {
    if (navigationClearTimerRef.current) {
      clearTimeout(navigationClearTimerRef.current);
      navigationClearTimerRef.current = null;
    }
    for (const timerId of timerIdsRef.current.values()) {
      clearTimeout(timerId);
    }
    timerIdsRef.current.clear();
    setNotifications([]);
    setHistory([]);
    setHistoryOpen(false);
  }, []);

  useEffect(() => {
    setLocale(getCurrentDocumentLocale());

    if (typeof document === "undefined") {
      return undefined;
    }

    const observer = new MutationObserver(() => {
      setLocale(getCurrentDocumentLocale());
    });
    observer.observe(document.documentElement, { attributeFilter: ["lang"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      for (const timerId of timerIdsRef.current.values()) {
        clearTimeout(timerId);
      }
      timerIdsRef.current.clear();
      if (navigationClearTimerRef.current) {
        clearTimeout(navigationClearTimerRef.current);
        navigationClearTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const handleNavigation = () => {
      const nextLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextLocation !== currentLocation) {
        currentLocation = nextLocation;
        if (navigationClearTimerRef.current) {
          clearTimeout(navigationClearTimerRef.current);
        }
        navigationClearTimerRef.current = setTimeout(() => {
          clearCurrentPageNotifications();
        }, 0);
      }
    };

    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      handleNavigation();
      return result;
    };
    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      handleNavigation();
      return result;
    };
    window.addEventListener("popstate", handleNavigation);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handleNavigation);
    };
  }, [clearCurrentPageNotifications]);

  const dismiss = useCallback((id: number) => {
    const timerId = timerIdsRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timerIdsRef.current.delete(id);
    }
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    const variant = input.variant ?? "info";
    const notification: NotificationRecord = {
      ...input,
      createdAt: new Date(),
      id,
      variant
    };

    setNotifications((current) => [...current, notification]);
    setHistory((current) => [...current, notification]);
    const durationMs = input.durationMs ?? (variant === "error" || variant === "warning" ? null : 5500);
    if (typeof durationMs === "number" && durationMs > 0) {
      const timerId = setTimeout(() => dismiss(id), durationMs);
      timerIdsRef.current.set(id, timerId);
    }
  }, [dismiss]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notify,
      success: (message, options) => notify({ ...options, message, variant: "success" }),
      error: (message, options) => notify({ ...options, message, variant: "error" }),
      info: (message, options) => notify({ ...options, message, variant: "info" }),
      warning: (message, options) => notify({ ...options, message, variant: "warning" }),
      dismiss
    }),
    [dismiss, notify]
  );
  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div aria-live="polite" style={{ ...viewportStyle, bottom: history.length ? 82 : 24 }}>
        {notifications.map((notification) => {
          const accentColor = getAccentColor(notification.variant);
          return (
            <section
              key={notification.id}
              role={notification.variant === "error" ? "alert" : "status"}
              style={{
                ...cardStyle,
                borderLeft: `5px solid ${accentColor}`
              }}
            >
              <div style={{ alignItems: "flex-start", display: "flex", gap: 12, justifyContent: "space-between" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  {notification.title ? <p style={titleStyle}>{notification.title}</p> : null}
                  <p style={messageStyle}>{notification.message}</p>
                </div>
                <button aria-label={labels.dismiss} onClick={() => dismiss(notification.id)} style={closeButtonStyle} type="button">
                  x
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {history.length ? (
        <>
          {historyOpen ? (
            <section aria-label={labels.historyTitle} style={historyPanelStyle}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
                <p style={titleStyle}>{labels.historyTitle}</p>
                <button aria-label={labels.dismiss} onClick={() => setHistoryOpen(false)} style={closeButtonStyle} type="button">
                  x
                </button>
              </div>
              {history
                .slice()
                .reverse()
                .map((notification) => {
                  const accentColor = getAccentColor(notification.variant);
                  return (
                    <article
                      key={`history-${notification.id}`}
                      style={{
                        ...historyItemStyle,
                        borderLeft: `5px solid ${accentColor}`
                      }}
                    >
                      <div>
                        <div style={metaStyle}>
                          <span style={{ ...badgeStyle, background: accentColor }}>{labels[notification.variant]}</span>
                          <time dateTime={notification.createdAt.toISOString()} style={timeStyle}>
                            {formatNotificationTime(notification.createdAt, locale)}
                          </time>
                        </div>
                      </div>
                      {notification.title ? <p style={titleStyle}>{notification.title}</p> : null}
                      <p style={messageStyle}>{notification.message}</p>
                    </article>
                  );
                })}
            </section>
          ) : null}
          <button
            aria-expanded={historyOpen}
            aria-label={labels.history}
            onClick={() => setHistoryOpen((current) => !current)}
            style={historyButtonStyle}
            type="button"
          >
            <span>{labels.history}</span>
            <span>{history.length}</span>
          </button>
        </>
      ) : null}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
