"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const settingsItems = [
  { href: "/settings/profile", labelKey: "settings.profileNav", textKey: "settings.profileNavText" },
  { href: "/settings/ai-agents", labelKey: "settings.aiAgentsNav", textKey: "settings.aiAgentsNavText" }
];

export function SettingsNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="settings-nav" aria-label={t("settings.navLabel")}>
      {settingsItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined} href={item.href}>
            <span>{t(item.labelKey)}</span>
            <small>{t(item.textKey)}</small>
          </Link>
        );
      })}
    </aside>
  );
}
