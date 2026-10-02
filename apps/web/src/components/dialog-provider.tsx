"use client";

import type { ReactNode } from "react";
import { DialogProvider, type DialogLabels } from "@cognelo/activity-ui";
import { useI18n } from "@/lib/i18n";

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const labels: DialogLabels = {
    cancel: t("common.cancel"),
    confirm: t("dialogs.confirm"),
    confirmTitle: t("dialogs.confirmTitle"),
    promptTitle: t("dialogs.promptTitle")
  };

  return <DialogProvider labels={labels}>{children}</DialogProvider>;
}
