"use client";
import type { ReactNode } from "react";
import { HelpProvider } from "@cognelo/activity-ui";
import { useI18n } from "@/lib/i18n";
export function AppHelpProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  return <HelpProvider locale={locale}>{children}</HelpProvider>;
}
