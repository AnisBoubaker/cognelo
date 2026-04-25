"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

type NotificationVariant = "success" | "error" | "info";

type NotificationInput = {
  message: string;
  title?: string;
  variant?: NotificationVariant;
  durationMs?: number;
};

type NotificationRecord = NotificationInput & {
  id: number;
  variant: NotificationVariant;
};

type NotificationsContextValue = {
  notify: (input: NotificationInput) => void;
  success: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  error: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  info: (message: string, options?: Omit<NotificationInput, "message" | "variant">) => void;
  dismiss: (id: number) => void;
};

const noop = () => {};

const NotificationsContext = createContext<NotificationsContextValue>({
  notify: noop,
  success: noop as NotificationsContextValue["success"],
  error: noop as NotificationsContextValue["error"],
  info: noop as NotificationsContextValue["info"],
  dismiss: noop as NotificationsContextValue["dismiss"]
});

const viewportStyle = {
  bottom: 24,
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

function getAccentColor(variant: NotificationVariant) {
  if (variant === "success") {
    return "#1f9d68";
  }
  if (variant === "error") {
    return "#b42318";
  }
  return "#247fd6";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const nextIdRef = useRef(1);
  const timerIdsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    return () => {
      for (const timerId of timerIdsRef.current.values()) {
        clearTimeout(timerId);
      }
      timerIdsRef.current.clear();
    };
  }, []);

  const dismiss = (id: number) => {
    const timerId = timerIdsRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timerIdsRef.current.delete(id);
    }
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  };

  const notify = (input: NotificationInput) => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    const variant = input.variant ?? "info";
    const notification: NotificationRecord = {
      ...input,
      id,
      variant
    };

    setNotifications((current) => [...current, notification]);
    const durationMs = input.durationMs ?? (variant === "error" ? 9000 : 5500);
    const timerId = setTimeout(() => dismiss(id), durationMs);
    timerIdsRef.current.set(id, timerId);
  };

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notify,
      success: (message, options) => notify({ ...options, message, variant: "success" }),
      error: (message, options) => notify({ ...options, message, variant: "error" }),
      info: (message, options) => notify({ ...options, message, variant: "info" }),
      dismiss
    }),
    []
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div aria-live="polite" style={viewportStyle}>
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
                <button aria-label="Dismiss notification" onClick={() => dismiss(notification.id)} style={closeButtonStyle} type="button">
                  ×
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
