"use client";

import { useEffect, type ReactNode } from "react";
import { DialogProvider, useDialogs, type DialogLabels } from "@cognelo/activity-ui";
import { setLiveChangeConfirmation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const labels: DialogLabels = {
    cancel: t("common.cancel"),
    confirm: t("dialogs.confirm"),
    close: t("common.close"),
    confirmTitle: t("dialogs.confirmTitle"),
    promptTitle: t("dialogs.promptTitle")
  };

  return <DialogProvider labels={labels}><LiveChangeDialogs />{children}</DialogProvider>;
}

function LiveChangeDialogs() {
  const dialogs = useDialogs();
  const { t } = useI18n();
  useEffect(() => {
    setLiveChangeConfirmation(async (canNotify) => {
      const confirmation = { title: t("courseDetail.liveSettingsTitle"), message: t("courseDetail.liveContentWarning"), confirmLabel: t("courseDetail.liveContentApply") };
      return canNotify
        ? dialogs.prompt({ ...confirmation, inputLabel: t("courseDetail.liveSettingsMessage"), maxLength: 4000 })
        : await dialogs.confirm(confirmation) ? "" : null;
    });
    return () => setLiveChangeConfirmation(null);
  }, [dialogs, t]);
  return null;
}
