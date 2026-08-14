"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";

export type SettingsSectionNavItem = {
  href: string;
  id: string;
  isActive: boolean;
  label: string;
  text: string;
};

const settingsItems = [
  { href: "/settings/profile", labelKey: "settings.profileNav", textKey: "settings.profileNavText" },
  { href: "/settings/ai-agents", labelKey: "settings.aiAgentsNav", textKey: "settings.aiAgentsNavText" }
];

export function SettingsNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user } = useAuth();
  const visibleItems = user?.roles.includes("admin")
    ? [
        ...settingsItems,
        { href: "/settings/users", labelKey: "settings.usersNav", textKey: "settings.usersNavText" },
        { href: "/settings/plugins", labelKey: "settings.pluginsNav", textKey: "settings.pluginsNavText" }
      ]
    : settingsItems;

  return <SettingsSectionNav
    ariaLabel={t("settings.navLabel")}
    items={visibleItems.map((item) => ({
      href: item.href,
      id: item.href,
      isActive: pathname === item.href || pathname.startsWith(`${item.href}/`),
      label: t(item.labelKey),
      text: t(item.textKey)
    }))}
  />;
}

export function SettingsSectionNav({ ariaLabel, items }: { ariaLabel: string; items: SettingsSectionNavItem[] }) {
  return (
    <aside className="settings-nav" aria-label={ariaLabel}>
      {items.map((item) => (
        <Link
          key={item.id}
          aria-current={item.isActive ? "page" : undefined}
          className={item.isActive ? "is-active" : undefined}
          href={item.href}
        >
          <span>{item.label}</span>
          <small>{item.text}</small>
        </Link>
      ))}
    </aside>
  );
}
