"use client";

import type { ReactNode } from "react";
import { NotificationProvider, type NotificationLabels } from "@cognelo/activity-ui";
import { useI18n } from "@/lib/i18n";

export function AppNotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const labels: NotificationLabels = {
    dismiss: t("notifications.dismiss"),
    history: t("notifications.history"),
    historyTitle: t("notifications.historyTitle"),
    success: t("notifications.success"),
    error: t("notifications.error"),
    info: t("notifications.info"),
    warning: t("notifications.warning")
  };

  return <NotificationProvider labels={labels}>{children}</NotificationProvider>;
}
