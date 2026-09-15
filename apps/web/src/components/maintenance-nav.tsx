"use client";

import { usePathname } from "next/navigation";
import { SettingsSectionNav } from "@/components/settings-nav";
import { useI18n } from "@/lib/i18n";

export function MaintenanceNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = [
    {
      href: "/settings/maintenance/media",
      id: "media",
      isActive: pathname === "/settings/maintenance" || pathname.startsWith("/settings/maintenance/media"),
      label: t("settings.maintenanceMediaNav"),
      text: t("settings.maintenanceMediaNavText")
    }
  ];

  return <SettingsSectionNav ariaLabel={t("settings.maintenanceSectionNavLabel")} items={items} />;
}
